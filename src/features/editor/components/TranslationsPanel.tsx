'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '@/services/translation/languages';
import type { TranslationView } from '@/types/translation';
import { TranslationProgress } from './TranslationProgress';

/**
 * 다국어 자막(번역) 패널 — 편집기 내 자체 섹션.
 *
 * 메인 편집 store(useSubtitleStore)와 분리되어 있어 원본 자막 편집/자동저장에
 * 영향을 주지 않는다(번역본은 read-only 트랙으로 관리: 추가·진행률·다운로드).
 *
 *   - GET /api/jobs/{jobId}/translations 로 기존 트랙 로드
 *   - 미생성 언어 칩 클릭 → POST /api/translations → 트랙 추가(진행률 자동 추적)
 *   - 무료 게이팅(잡당 1언어) 초과 시 안내
 */
interface Track {
  id: string;
  lang: string;
}

export function TranslationsPanel({ jobId }: { jobId: string }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/translations`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? '번역 목록 로드 실패');
        if (cancelled) return;
        const items = (json.data as TranslationView[]) ?? [];
        setTracks(items.map((t) => ({ id: t.id, lang: t.targetLang })));
      } catch {
        // 목록 로드 실패는 조용히 — 추가는 여전히 가능
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const existing = new Set(tracks.map((t) => t.lang));
  const available = SUPPORTED_LANGUAGES.filter((l) => !existing.has(l.code));

  const addLang = useCallback(
    async (lang: string) => {
      setSubmitting(lang);
      setError(null);
      try {
        const res = await fetch('/api/translations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, targetLang: lang }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? '번역 요청 실패');
        const id = json.data.translationId as string;
        setTracks((prev) =>
          prev.some((t) => t.id === id) ? prev : [...prev, { id, lang }],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : '번역 요청 실패');
      } finally {
        setSubmitting(null);
      }
    },
    [jobId],
  );

  return (
    <div className="bento p-5 sm:p-6">
      <header className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">다국어 자막 (번역)</h2>
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          NEW
        </span>
      </header>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        완성된 한국어 자막을 다른 언어로 번역해 SRT로 내려받을 수 있어요. 무료 플랜은 영상당 1개 언어까지 번역됩니다.
      </p>

      {/* 기존/진행 중 트랙 */}
      {!loading && tracks.length > 0 && (
        <div className="mb-4 space-y-2">
          {tracks.map((t) => (
            <TranslationProgress key={t.id} translationId={t.id} lang={t.lang} />
          ))}
        </div>
      )}

      {/* 언어 추가 */}
      {available.length > 0 ? (
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-muted-foreground">언어 추가</span>
          <div className="flex flex-wrap gap-1.5">
            {available.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => addLang(l.code)}
                disabled={submitting !== null}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-50',
                  'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span className="text-sm">{l.flag}</span>
                {submitting === l.code ? '요청 중...' : l.nativeName}
              </button>
            ))}
          </div>
        </div>
      ) : (
        !loading && (
          <p className="text-xs text-muted-foreground">추가할 수 있는 언어를 모두 번역했어요.</p>
        )
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
