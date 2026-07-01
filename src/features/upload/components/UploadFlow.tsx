'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UploadDropzone } from './UploadDropzone';
import { JobProgress, type JobProgressData } from './JobProgress';
import { GuestCapBanner } from './GuestCapBanner';
import { Button } from '@/components/ui/button';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { extractVideoMetadata } from '../lib/video-metadata';
import { putFile, UploadError } from '../lib/upload-client';
import { track } from '@/lib/analytics';
import {
  ALLOWED_VIDEO_MIME,
  GUEST_CAPS,
  formatBytes,
  formatDuration,
} from '../lib/guest-caps';
import type { UploadInitInput, UploadInitResponse } from '@/app/api/uploads/init/schema';

/**
 * 영상 업로드 전체 흐름 오케스트레이터.
 *
 * 상태:
 *   idle
 *   validating → 메타 추출 + 캡 검증
 *   cap-error → 캡 초과 (회원가입 CTA)
 *   initializing → /api/uploads/init
 *   uploading → Supabase Storage PUT (XHR 진행률)
 *   completing → /api/uploads/[id]/complete
 *   queued / transcribing → SSE 실시간 상태
 *   finished → 다운로드/편집기 버튼
 *   failed → 재시도
 *   error → 일반 에러
 */

type Phase =
  | 'idle'
  | 'cap-error'
  | 'validating'
  | 'initializing'
  | 'uploading'
  | 'completing'
  | 'queued'
  | 'transcribing'
  | 'finished'
  | 'failed'
  | 'error';

type FlowState =
  | { phase: 'idle' }
  | { phase: 'cap-error'; reason: string; file?: File }
  | {
      phase:
        | 'validating'
        | 'initializing'
        | 'uploading'
        | 'completing'
        | 'queued'
        | 'transcribing'
        | 'finished'
        | 'failed';
      file: File;
      durationSec?: number;
      percent?: number;
      jobId?: string;
      queuePosition?: number | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      /** SSE 단계 시작 시각 — 경과 시간/ETA 계산용 */
      sseStartedAt?: number;
      /** SSE에서 받은 원본 잡 상태 */
      serverStatus?: string;
    }
  | { phase: 'error'; message: string; file?: File };

interface StreamPayload {
  status: string;
  progress: number;
  queuePosition: number | null;
  hasSubtitle: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

export function UploadFlow() {
  const [state, setState] = useState<FlowState>({ phase: 'idle' });
  // null=확인 중, false=게스트, true=회원 (게스트 안내 배너는 게스트에게만)
  const [authed, setAuthed] = useState<boolean | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const finishedTrackedRef = useRef(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  // 클린업
  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      eventSourceRef.current?.close();
    };
  }, []);

  const reset = useCallback(() => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    finishedTrackedRef.current = false;
    setState({ phase: 'idle' });
  }, []);

  const subscribeSse = useCallback((jobId: string, file: File, durationSec: number) => {
    eventSourceRef.current?.close();
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = es;
    const sseStartedAt = Date.now();

    es.addEventListener('status', (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as StreamPayload;
        if (data.status === 'finished' && !finishedTrackedRef.current) {
          finishedTrackedRef.current = true;
          track('job_finished', { jobId });
        }
        setState((prev) => {
          if (
            prev.phase === 'idle' ||
            prev.phase === 'cap-error' ||
            prev.phase === 'error'
          ) {
            return prev;
          }
          const nextPhase = mapServerStatusToPhase(data.status);
          return {
            phase: nextPhase,
            file,
            durationSec,
            percent: data.progress,
            jobId,
            queuePosition: data.queuePosition,
            errorCode: data.errorCode,
            errorMessage: data.errorMessage,
            sseStartedAt,
            serverStatus: data.status,
          };
        });
      } catch {
        // ignore parse failure
      }
    });

    es.addEventListener('done', () => {
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('error', () => {
      // 재연결은 브라우저가 자동 처리. 에러는 SSE 자체 실패 시만.
      // 안전상 닫고 폴링으로 폴백할 수 있으나 MVP는 그대로 두기.
    });
  }, []);

  const onFileSelected = useCallback(
    async (file: File) => {
      // 1. MIME
      if (!ALLOWED_VIDEO_MIME.includes(file.type as (typeof ALLOWED_VIDEO_MIME)[number])) {
        setState({
          phase: 'cap-error',
          reason: `지원하지 않는 형식입니다 (${file.type || '알 수 없음'}). MP4·MOV·MKV·WebM만 가능합니다.`,
          file,
        });
        return;
      }

      // 2. 게스트 크기 사전
      if (file.size > GUEST_CAPS.sizeBytes) {
        setState({
          phase: 'cap-error',
          reason: `파일 크기 ${formatBytes(file.size)}가 게스트 한도 ${formatBytes(GUEST_CAPS.sizeBytes)}를 초과합니다.`,
          file,
        });
        return;
      }

      // 3. 메타데이터
      track('upload_started', {
        properties: { sizeBytes: file.size, mime: file.type || 'unknown' },
      });
      setState({ phase: 'validating', file });
      let durationSec: number;
      try {
        const meta = await extractVideoMetadata(file);
        durationSec = meta.durationSec;
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : '영상 분석 실패',
          file,
        });
        return;
      }

      // 4. 게스트 길이 사전
      if (durationSec > GUEST_CAPS.durationSec) {
        setState({
          phase: 'cap-error',
          reason: `영상 길이 ${formatDuration(durationSec)}이(가) 게스트 한도 ${formatDuration(GUEST_CAPS.durationSec)}를 초과합니다.`,
          file,
        });
        return;
      }

      // 5. init
      setState({ phase: 'initializing', file, durationSec });
      let initResp: UploadInitResponse;
      try {
        const reqBody: UploadInitInput = {
          fileName: file.name,
          fileSize: file.size,
          durationSec,
          mimeType: file.type,
        };
        const res = await fetch('/api/uploads/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });
        const json = await res.json();
        if (!res.ok) {
          const code = json?.error?.code;
          const message = json?.error?.message ?? '업로드 초기화 실패';
          if (
            code === 'PAYLOAD_TOO_LARGE' ||
            code === 'QUOTA_EXCEEDED' ||
            code === 'UNSUPPORTED_MEDIA_TYPE'
          ) {
            setState({ phase: 'cap-error', reason: message, file });
            return;
          }
          setState({ phase: 'error', message, file });
          return;
        }
        initResp = json.data as UploadInitResponse;
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : '서버 통신 실패',
          file,
        });
        return;
      }

      // 6. PUT to Storage
      uploadAbortRef.current = new AbortController();
      setState({
        phase: 'uploading',
        file,
        durationSec,
        percent: 0,
        jobId: initResp.jobId,
      });
      try {
        await putFile({
          url: initResp.uploadUrl,
          file,
          contentType: file.type,
          signal: uploadAbortRef.current.signal,
          onProgress: (p) => {
            setState((prev) =>
              prev.phase === 'uploading' ? { ...prev, percent: p.percent } : prev,
            );
          },
        });
      } catch (err) {
        const message =
          err instanceof UploadError ? err.message : '업로드 중 알 수 없는 오류';
        setState({ phase: 'error', message, file });
        return;
      } finally {
        uploadAbortRef.current = null;
      }

      // 7. complete (uploading → queued + enqueue)
      setState({
        phase: 'completing',
        file,
        durationSec,
        percent: 100,
        jobId: initResp.jobId,
      });
      try {
        const res = await fetch(`/api/uploads/${initResp.jobId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? 'complete 실패');
        }
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'complete 실패',
          file,
        });
        return;
      }

      track('upload_completed', { jobId: initResp.jobId });

      // 8. SSE 구독 — queued / transcribing / finished / failed
      setState({
        phase: 'queued',
        file,
        durationSec,
        percent: 0, // STT progress 별도 (progress_percent column reset)
        jobId: initResp.jobId,
      });
      subscribeSse(initResp.jobId, file, durationSec);
    },
    [subscribeSse],
  );

  // ====== 렌더 ======

  if (state.phase === 'idle') {
    return (
      <div>
        {authed === false && <GuestCapBanner />}
        <UploadDropzone onFileSelected={onFileSelected} />
      </div>
    );
  }

  if (state.phase === 'cap-error') {
    return (
      <div>
        <GuestCapBanner variant="exceeded" reason={state.reason} />
        <UploadDropzone onFileSelected={onFileSelected} />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-4">
        <div className="bento p-6 text-destructive">
          <p className="font-semibold">처리 실패</p>
          <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
        </div>
        <Button onClick={reset} variant="outline">
          다시 시도
        </Button>
      </div>
    );
  }

  if (state.phase === 'failed') {
    return (
      <div className="space-y-4">
        <div className="bento p-6">
          <p className="font-semibold text-destructive">자막 생성 실패</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.errorMessage ?? '워커에서 STT 처리 중 오류가 발생했습니다.'}
          </p>
          {state.errorCode && (
            <p className="mt-1 font-mono text-xs text-muted-foreground/60">
              code: {state.errorCode}
            </p>
          )}
        </div>
        <Button onClick={reset} variant="outline">
          다른 영상 시도
        </Button>
      </div>
    );
  }

  if (state.phase === 'finished' && state.jobId) {
    return (
      <div className="space-y-4">
        <div className="bento aurora-subtle p-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckIcon />
          </div>
          <h2 className="text-display text-3xl">
            <span className="text-aurora">자막 완성!</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            편집기에서 미리보기·편집하거나 SRT 파일로 바로 받으세요.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="lg">
              <Link href={`/editor/${state.jobId}`}>
                편집기 열기
                <ArrowIcon />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a
                href={`/api/subtitles/${state.jobId}/download`}
                onClick={() => track('srt_downloaded', { jobId: state.jobId })}
              >
                SRT 다운로드
              </a>
            </Button>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              다른 영상 올리기
            </button>
          </div>
          <p className="mt-6 font-mono text-[11px] text-muted-foreground/60">
            job: {state.jobId}
          </p>
        </div>
      </div>
    );
  }

  // queued | transcribing | uploading | completing | initializing | validating
  const progressData: JobProgressData = {
    fileName: state.file.name,
    fileSize: state.file.size,
    durationSec: state.durationSec,
    phase: mapPhaseToProgressVariant(state.phase),
    percent: state.percent,
    jobId: state.jobId,
    queuePosition: state.queuePosition ?? null,
    statusLabel: phaseLabel(state.phase),
    sseStartedAt: state.sseStartedAt,
    serverStatus: state.serverStatus,
  };

  return (
    <div className="space-y-4">
      <JobProgress data={progressData} />
      <div className="flex gap-2">
        {state.phase === 'uploading' && (
          <Button onClick={reset} variant="outline">
            취소
          </Button>
        )}
        {(state.phase === 'queued' ||
          state.phase === 'transcribing' ||
          state.phase === 'completing') &&
          state.jobId && (
            <Button onClick={() => cancelJob(state.jobId!, reset)} variant="outline" size="sm">
              잡 취소
            </Button>
          )}
      </div>
    </div>
  );
}

// ===== helpers =====

async function cancelJob(jobId: string, onDone: () => void) {
  try {
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
  } catch {
    // ignore
  }
  onDone();
}

type ActivePhase =
  | 'uploading'
  | 'queued'
  | 'transcribing'
  | 'finished'
  | 'failed';

function mapServerStatusToPhase(status: string): ActivePhase {
  switch (status) {
    case 'pending':
    case 'uploading':
      return 'uploading';
    case 'queued':
      return 'queued';
    case 'transcribing':
      return 'transcribing';
    case 'finished':
      return 'finished';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'queued';
  }
}

function mapPhaseToProgressVariant(
  phase: Phase,
): 'validating' | 'initializing' | 'uploading' | 'done' {
  switch (phase) {
    case 'validating':
      return 'validating';
    case 'initializing':
      return 'initializing';
    case 'uploading':
    case 'completing':
      return 'uploading';
    case 'queued':
    case 'transcribing':
      return 'initializing';
    case 'finished':
      return 'done';
    default:
      return 'initializing';
  }
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'validating':
      return '검증 중';
    case 'initializing':
      return '준비 중';
    case 'uploading':
      return '업로드 중';
    case 'completing':
      return '큐 등록 중';
    case 'queued':
      return '처리 대기 중';
    case 'transcribing':
      return '자막 생성 중';
    case 'finished':
      return '완료';
    case 'failed':
      return '실패';
    default:
      return '';
  }
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
