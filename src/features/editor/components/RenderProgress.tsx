'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RenderStatus } from '@/types/caption-style';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 렌더 진행률 + 결과 (Design §5.1). store의 renderId를 폴링.
 * pending/rendering → 진행 표시, done → 다운로드, failed → 에러+다시 시도.
 * 다운로드 URL은 서버가 done일 때만 signed URL로 내려준다.
 */
const POLL_INTERVAL_MS = 2500;

interface RenderView {
  status: RenderStatus;
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

    async function poll() {
      try {
        const res = await fetch(`/api/renders/${renderId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? '상태 조회 실패');
        if (cancelled) return;

        const data = json.data as RenderView;
        setView(data);
        setPollError(null);

        if (data.status === 'done' || data.status === 'failed') {
          return; // 종료 상태 — 폴링 중단
        }
      } catch (err) {
        if (cancelled) return;
        setPollError(err instanceof Error ? err.message : '상태 조회 실패');
      }
      if (!cancelled) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [renderId]);

  if (!renderId) return null;

  const status = view?.status ?? 'pending';
  const active = status === 'pending' || status === 'rendering';

  return (
    <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {active && (
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <span
            className={cnStatus(status)}
          >
            {STATUS_LABEL[status]}
          </span>
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
        <p className="mt-2 text-xs text-muted-foreground">
          영상 길이에 따라 1~2분 정도 걸릴 수 있어요. 이 창을 닫아도 처리는 계속됩니다.
        </p>
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
