'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getLanguage } from '@/services/translation/languages';
import type { TranslationStatus } from '@/types/translation';

/**
 * 번역 트랙 1건의 진행률 + 결과. translationId를 SSE로 실시간 구독(렌더와 동일 패턴).
 * pending/translating → 진행률, done → 다운로드(signed URL), failed → 에러.
 * EventSource 미지원/오류 시 폴링 폴백.
 */
const POLL_FALLBACK_MS = 2500;

interface TView {
  status: TranslationStatus;
  progress: number;
  downloadUrl: string | null;
  errorCode: string | null;
}

const STATUS_LABEL: Record<TranslationStatus, string> = {
  pending: '대기 중',
  translating: '번역 중',
  done: '완료',
  failed: '실패',
};

export function TranslationProgress({
  translationId,
  lang,
}: {
  translationId: string;
  lang: string;
}) {
  const [view, setView] = useState<TView | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let terminal = false;

    const isTerminal = (s: TranslationStatus) => s === 'done' || s === 'failed';

    async function pollOnce() {
      try {
        const res = await fetch(`/api/translations/${translationId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? '상태 조회 실패');
        if (cancelled) return;
        const d = json.data as {
          status: TranslationStatus;
          progressPercent: number;
          downloadUrl: string | null;
          errorCode: string | null;
        };
        setView({ status: d.status, progress: d.progressPercent ?? 0, downloadUrl: d.downloadUrl, errorCode: d.errorCode });
        if (isTerminal(d.status)) {
          terminal = true;
          return;
        }
      } catch {
        // 조용히 재시도
      }
      if (!cancelled) timerRef.current = setTimeout(pollOnce, POLL_FALLBACK_MS);
    }

    if (typeof EventSource !== 'undefined') {
      es = new EventSource(`/api/translations/${translationId}/stream`);
      es.addEventListener('status', (e) => {
        if (cancelled) return;
        try {
          const d = JSON.parse((e as MessageEvent).data) as TView;
          setView(d);
          if (isTerminal(d.status)) terminal = true;
        } catch {}
      });
      es.addEventListener('done', () => {
        terminal = true;
        es?.close();
      });
      es.addEventListener('error', () => {
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
  }, [translationId]);

  const meta = getLanguage(lang);
  const status = view?.status ?? 'pending';
  const active = status === 'pending' || status === 'translating';
  const pct = Math.max(0, Math.min(100, view?.progress ?? 0));

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta?.flag ?? '🌐'}</span>
          <span className="text-sm font-semibold text-foreground">{meta?.nativeName ?? lang}</span>
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <span className={cnStatus(status)}>{STATUS_LABEL[status]}</span>
          {status === 'translating' && (
            <span className="font-mono text-xs tabular-nums text-primary">{pct}%</span>
          )}
        </div>
      </div>

      {active && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${status === 'translating' ? Math.max(4, pct) : 6}%` }}
          />
        </div>
      )}

      {status === 'done' && view?.downloadUrl && (
        <Button asChild variant="outline" size="sm" className="mt-2.5 w-full">
          <a href={view.downloadUrl} download>
            {(meta?.nativeName ?? lang)} SRT 다운로드
          </a>
        </Button>
      )}

      {status === 'failed' && (
        <p className="mt-2 text-xs text-destructive">
          번역에 실패했습니다{view?.errorCode ? ` (${view.errorCode})` : ''}. 다시 시도해주세요.
        </p>
      )}
    </div>
  );
}

function cnStatus(status: TranslationStatus): string {
  const base = 'text-xs font-semibold';
  if (status === 'done') return `${base} text-primary`;
  if (status === 'failed') return `${base} text-destructive`;
  return `${base} text-muted-foreground`;
}
