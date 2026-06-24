'use client';

import { useEffect, useState } from 'react';
import { formatBytes, formatDuration } from '../lib/guest-caps';

/**
 * 업로드/처리 진행률 표시.
 *
 * phase variant:
 *   - validating / initializing: spinner
 *   - uploading: progress bar (XHR-driven, percent 0~100)
 *   - done: success card
 *
 * SSE 단계 (queued/transcribing)에는:
 *   - statusLabel 강조 표시
 *   - 경과 시간 카운터
 *   - ETA (남은 시간 예측)
 *   - 단계별 친절한 안내 메시지
 *   - 큐에서 30초 이상 대기 시 "워커가 작동 중인지 확인" 안내
 */
export interface JobProgressData {
  fileName: string;
  fileSize: number;
  durationSec?: number;
  phase: 'validating' | 'initializing' | 'uploading' | 'done';
  percent?: number;
  jobId?: string;
  queuePosition?: number | null;
  statusLabel?: string;
  /** queued/transcribing 등 SSE 단계 시작 시각 (Date.now()) */
  sseStartedAt?: number;
  /** 서버에서 받은 잡 상태 (queued | transcribing | ...) */
  serverStatus?: string;
}

export function JobProgress({ data }: { data: JobProgressData }) {
  const label = data.statusLabel ?? phaseLabel(data.phase);
  const showBar = data.phase === 'uploading' || data.phase === 'done';
  const isSpinning = data.phase === 'validating' || data.phase === 'initializing';
  const percent = data.phase === 'done' ? 100 : (data.percent ?? 0);
  const showSseMeta =
    isSpinning &&
    !!data.sseStartedAt &&
    (data.serverStatus === 'queued' || data.serverStatus === 'transcribing');

  return (
    <div className="@container enter-fade-up">
      <div className="bento overflow-hidden p-6 @md:p-7">
        <div className="flex items-start gap-3">
          <div
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            {isSpinning ? <SpinnerIcon /> : <FilmIcon />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold tracking-tight">{data.fileName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{formatBytes(data.fileSize)}</span>
              {data.durationSec ? (
                <>
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                  <span>{formatDuration(data.durationSec)}</span>
                </>
              ) : null}
            </p>
          </div>

          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor:
                data.phase === 'done'
                  ? 'color-mix(in oklab, var(--color-success) 15%, var(--color-card) 85%)'
                  : 'color-mix(in oklab, var(--color-primary) 15%, var(--color-card) 85%)',
              color: data.phase === 'done' ? 'var(--color-success)' : 'var(--color-primary)',
            }}
          >
            {label}
          </span>
        </div>

        {showBar && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.phase === 'done' ? '업로드 완료' : '업로드 중'}
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {percent.toString().padStart(2, '0')}%
              </span>
            </div>
            <div
              className="relative h-2 overflow-hidden rounded-full"
              style={{
                backgroundColor:
                  'color-mix(in oklab, var(--color-primary) 10%, var(--color-muted) 90%)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${percent}%`,
                  background:
                    data.phase === 'done'
                      ? 'linear-gradient(90deg, var(--color-success), oklch(0.7 0.18 145))'
                      : 'linear-gradient(90deg, var(--color-primary), oklch(0.65 0.22 320))',
                }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* SSE 단계 (queued / transcribing) — 친절한 진행 표시 */}
        {showSseMeta && data.sseStartedAt && (
          <SseProgressBlock
            startedAt={data.sseStartedAt}
            serverStatus={data.serverStatus}
            queuePosition={data.queuePosition ?? null}
            sttPercent={data.percent ?? 0}
            videoDurationSec={data.durationSec ?? 0}
          />
        )}
      </div>
    </div>
  );
}

/* ============== SSE 진행 블록 (queued + transcribing) ============== */

function SseProgressBlock({
  startedAt,
  serverStatus,
  queuePosition,
  sttPercent,
  videoDurationSec,
}: {
  startedAt: number;
  serverStatus?: string;
  queuePosition: number | null;
  sttPercent: number;
  videoDurationSec: number;
}) {
  // 1초마다 리렌더 (경과 시간 카운터)
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  const stuckOnQueued =
    serverStatus === 'queued' && elapsedSec >= 30 && (queuePosition === null || queuePosition === 0);

  // ETA 계산 (transcribing 단계):
  //   - 기본 모델 로딩 25초 가정 (캐시되면 더 빠름)
  //   - STT는 영상 길이의 약 0.08배 (12.83x realtime, RTX 4060 small 기준)
  //   - 다운로드/업로드 ~3초
  const estimatedTotalSec = 25 + Math.ceil(videoDurationSec * 0.08) + 3;
  const remainingFromStt =
    sttPercent > 0
      ? Math.max(0, Math.ceil((estimatedTotalSec * (100 - sttPercent)) / 100))
      : null;
  const remainingFromElapsed = Math.max(0, estimatedTotalSec - elapsedSec);
  const eta = remainingFromStt ?? remainingFromElapsed;

  // 단계 메시지 (transcribing의 percent 구간별)
  const friendlyMessage = friendlyStageMessage({
    serverStatus,
    sttPercent,
    elapsedSec,
  });

  return (
    <div className="mt-6 space-y-4">
      {/* Step Dots */}
      <StepDots serverStatus={serverStatus} />

      {/* Friendly 메시지 + 경과/예상 시간 */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-background/30 p-4 backdrop-blur-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {friendlyMessage}
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono text-muted-foreground tabular-nums">
          <div className="flex items-center gap-1.5">
            <ClockIcon />
            경과 {formatHms(elapsedSec)}
          </div>
          <div className="flex items-center gap-1.5">
            <HourglassIcon />
            예상 남은 시간 {eta > 0 ? `약 ${formatHms(eta)}` : '곧 완료'}
          </div>
        </div>

        {/* STT 단계 진행률 */}
        {serverStatus === 'transcribing' && (
          <div className="pt-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">자막 생성 진행률</span>
              <span className="font-mono font-semibold text-primary tabular-nums">
                {sttPercent}%
              </span>
            </div>
            <div
              className="relative h-1.5 overflow-hidden rounded-full"
              style={{
                backgroundColor:
                  'color-mix(in oklab, var(--color-primary) 10%, var(--color-muted) 90%)',
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${sttPercent}%`,
                  background:
                    'linear-gradient(90deg, var(--color-primary), oklch(0.65 0.22 320))',
                }}
              />
              {/* shimmer overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-50 animate-shimmer"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                  backgroundSize: '1000px 100%',
                }}
              />
            </div>
          </div>
        )}

        {/* 큐에 너무 오래 대기 시 안내 */}
        {stuckOnQueued && (
          <div
            className="mt-3 rounded-lg border p-3 text-xs"
            style={{
              borderColor: 'color-mix(in oklab, var(--color-accent) 30%, transparent 70%)',
              backgroundColor:
                'color-mix(in oklab, var(--color-accent) 8%, var(--color-card) 92%)',
            }}
          >
            <p className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-accent)' }}>
              <WarnIcon />{' '}
              {process.env.NODE_ENV === 'development'
                ? '워커가 작동 중인지 확인해주세요'
                : '처리가 조금 지연되고 있어요'}
            </p>
            {process.env.NODE_ENV === 'development' ? (
              <p className="mt-1 leading-relaxed text-muted-foreground">
                30초 이상 큐에서 대기 중입니다. 별도 터미널에서{' '}
                <code className="rounded bg-background/50 px-1 py-0.5 font-mono text-[11px]">
                  npm run worker:poll
                </code>
                이 실행 중이어야 자막이 만들어져요.
              </p>
            ) : (
              <p className="mt-1 leading-relaxed text-muted-foreground">
                대기열이 잠시 붐비고 있어요. 이 화면을 닫아도 처리는 계속되며, 완료되면
                알림을 보내드려요. 잠시 후 ‘내 이력’에서 다시 확인할 수 있어요.
              </p>
            )}
          </div>
        )}

        <p className="pt-1 text-xs text-muted-foreground">
          처리 중에도 화면을 떠나도 됩니다. 잡 ID로 나중에 다시 조회 가능합니다.
        </p>
      </div>
    </div>
  );
}

/* ============== Step Dots ============== */

function StepDots({ serverStatus }: { serverStatus?: string }) {
  // 단계: upload → queued → transcribing → finished
  const steps = [
    { key: 'upload', label: '업로드', done: true, active: false },
    {
      key: 'queued',
      label: '큐 대기',
      done: serverStatus === 'transcribing' || serverStatus === 'finished',
      active: serverStatus === 'queued',
    },
    {
      key: 'transcribe',
      label: '자막 생성',
      done: serverStatus === 'finished',
      active: serverStatus === 'transcribing',
    },
    {
      key: 'finished',
      label: '완료',
      done: serverStatus === 'finished',
      active: false,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2">
          <div
            className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition"
            style={{
              backgroundColor: s.done
                ? 'var(--color-success)'
                : s.active
                  ? 'color-mix(in oklab, var(--color-primary) 20%, var(--color-card) 80%)'
                  : 'color-mix(in oklab, var(--color-muted) 100%, transparent 0%)',
              color: s.done
                ? 'var(--color-success-foreground)'
                : s.active
                  ? 'var(--color-primary)'
                  : 'var(--color-muted-foreground)',
              boxShadow: s.active ? 'var(--shadow-glow)' : 'none',
            }}
          >
            {s.done ? (
              <CheckTinyIcon />
            ) : (
              <span>{i + 1}</span>
            )}
            {s.active && (
              <span className="absolute -inset-1 animate-pulse-glow rounded-full" />
            )}
          </div>
          <span
            className={
              'text-xs font-medium transition ' +
              (s.done ? 'text-success' : s.active ? 'text-foreground' : 'text-muted-foreground/60')
            }
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className="ml-1 hidden h-px flex-1 transition sm:block"
              style={{
                background: s.done
                  ? 'linear-gradient(90deg, var(--color-success), color-mix(in oklab, var(--color-success) 0%, transparent 100%))'
                  : 'var(--color-border)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ============== utilities ============== */

function friendlyStageMessage({
  serverStatus,
  sttPercent,
  elapsedSec,
}: {
  serverStatus?: string;
  sttPercent: number;
  elapsedSec: number;
}): string {
  if (serverStatus === 'queued') {
    if (elapsedSec < 5) return '큐에 등록됐어요. 곧 워커가 가져갑니다.';
    if (elapsedSec < 30) return '워커가 곧 작업을 시작합니다.';
    return '워커가 작업을 가져오기까지 잠시 더 기다려주세요.';
  }
  if (serverStatus === 'transcribing') {
    if (sttPercent < 8) return '영상을 다운로드하고 있어요.';
    if (sttPercent < 20) return '음성을 추출하고 있어요.';
    if (sttPercent < 30) return 'AI 모델을 준비하고 있어요.';
    if (sttPercent < 70) return 'AI가 한국어 자막을 만드는 중...';
    if (sttPercent < 92) return '거의 다 됐어요. 마무리 인식 중.';
    return '자막을 저장하고 있어요.';
  }
  return '처리 중...';
}

function formatHms(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}초`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

function phaseLabel(phase: JobProgressData['phase']): string {
  switch (phase) {
    case 'validating':
      return '검증 중';
    case 'initializing':
      return '준비 중';
    case 'uploading':
      return '업로드 중';
    case 'done':
      return '완료';
  }
}

/* ============== icons ============== */

function FilmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckTinyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
