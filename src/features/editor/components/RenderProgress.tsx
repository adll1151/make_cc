'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RenderStatus } from '@/types/caption-style';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 렌더 진행률 + 결과 (Design §5.1). store의 renderId를 SSE로 실시간 구독.
 * pending/rendering → 진행률 % 바, done → 다운로드, failed → 에러+다시 시도.
 * 서버(SSE)가 status·progress·downloadUrl(done일 때만 signed URL)을 푸시한다.
 * EventSource 미지원/오류 시 폴링으로 자동 폴백.
 */
const POLL_FALLBACK_MS = 2500;

interface RenderView {
  status: RenderStatus;
  progress: number;
  downloadUrl: string | null;
  errorMessage: string | null;
}

const STATUS_LABEL: Record<RenderStatus, string> = {
  pending: '대기 중',
  rendering: '렌더링 중',
  done: '완료',
  failed: '실패',
};

export function RenderProgress() {
  const renderId = useCaptionStyle((s) => s.renderId);
  const setRenderId = useCaptionStyle((s) => s.setRenderId);

  const [view, setView] = useState<RenderView | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!renderId) {
      setView(null);
      setPollError(null);
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let terminal = false;

    const isTerminal = (s: RenderStatus) => s === 'done' || s === 'failed';

    // ---- 폴백: SSE가 안 되는 환경에서 폴링 ----
    async function pollOnce() {
      try {
        const res = await fetch(`/api/renders/${renderId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? '상태 조회 실패');
        if (cancelled) return;
        const d = json.data as { status: RenderStatus; progressPercent: number; downloadUrl: string | null; errorMessage: string | null };
        setView({ status: d.status, progress: d.progressPercent ?? 0, downloadUrl: d.downloadUrl, errorMessage: d.errorMessage });
        setPollError(null);
        if (isTerminal(d.status)) {
          terminal = true;
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setPollError(err instanceof Error ? err.message : '상태 조회 실패');
      }
      if (!cancelled) timerRef.current = setTimeout(pollOnce, POLL_FALLBACK_MS);
    }

    // ---- 기본: SSE 실시간 구독 ----
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(`/api/renders/${renderId}/stream`);

      es.addEventListener('status', (e) => {
        if (cancelled) return;
        try {
          const d = JSON.parse((e as MessageEvent).data) as RenderView;
          setView(d);
          setPollError(null);
          if (isTerminal(d.status)) terminal = true;
        } catch {}
      });
      es.addEventListener('done', () => {
        terminal = true;
        es?.close();
      });
      es.addEventListener('error', () => {
        // 종료 후 정상 close는 무시, 그 외엔 폴링으로 폴백
        if (cancelled || terminal) return;
        es?.close();
        es = null;
        pollOnce();
      });
    } else {
      pollOnce();
    }

    return () => {
      cancelled = true;
      es?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [renderId]);

  if (!renderId) return null;

  const status = view?.status ?? 'pending';
  const active = status === 'pending' || status === 'rendering';
  const pct = Math.max(0, Math.min(100, view?.progress ?? 0));

  return (
    <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {active && (
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <span className={cnStatus(status)}>{STATUS_LABEL[status]}</span>
          {status === 'rendering' && (
            <span className="font-mono text-sm tabular-nums text-primary">{pct}%</span>
          )}
        </div>
        {(status === 'done' || status === 'failed') && (
          <button
            type="button"
            onClick={() => setRenderId(null)}
            className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            새로 만들기
          </button>
        )}
      </div>

      {active && (
        <>
          {/* 진행률 바 — rendering이면 실제 %, pending이면 살짝 채워 대기 표시 */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
              style={{ width: `${status === 'rendering' ? Math.max(4, pct) : 6}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            영상 길이에 따라 1~2분 정도 걸릴 수 있어요. 이 창을 닫아도 처리는 계속됩니다.
          </p>
        </>
      )}

      {status === 'done' && view?.downloadUrl && (
        <Button asChild variant="gradient" size="default" className="mt-3 w-full">
          <a href={view.downloadUrl} download>
            번인 MP4 다운로드
          </a>
        </Button>
      )}

      {status === 'failed' && (
        <p className="mt-2 text-xs text-destructive">
          {view?.errorMessage ?? '렌더에 실패했습니다. 다시 시도해주세요.'}
        </p>
      )}

      {pollError && active && (
        <p className="mt-2 text-xs text-muted-foreground">{pollError} — 자동 재시도 중...</p>
      )}
    </div>
  );
}

function cnStatus(status: RenderStatus): string {
  const base = 'text-sm font-semibold';
  if (status === 'done') return `${base} text-primary`;
  if (status === 'failed') return `${base} text-destructive`;
  return `${base} text-foreground`;
}
