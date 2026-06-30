'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { useCaptionStyle } from '../hooks/useCaptionStyle';
import { extractCaptionSignals } from '../lib/caption-signals';
import { suggestCaptionStyle } from '../lib/caption-suggest';

/**
 * 자막 스타일 어시(Tier 1) — 영상·자막을 분석해 어울리는 번인 프리셋을 추천.
 *
 * 비용 0(순수 클라이언트 휴리스틱). 제안만 하고 강제하지 않으며, 언제든 닫거나
 * 다른 프리셋으로 오버라이드 가능. 신호 부족(자막 없음) 시 아무것도 렌더하지 않음.
 */
export function CaptionSuggestion() {
  const cues = useSubtitleStore((s) => s.cues);
  const speakerMap = useSubtitleStore((s) => s.speakerMap);
  const currentTemplate = useCaptionStyle((s) => s.style.template);
  const applyTemplate = useCaptionStyle((s) => s.applyTemplate);

  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // 편집기 영상 엘리먼트에서 종횡비 읽기 (로드 후, 메타데이터 갱신 시 재측정)
  useEffect(() => {
    const v = document.querySelector('video');
    if (!v) return;
    const read = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setDims({ width: v.videoWidth, height: v.videoHeight });
      }
    };
    read();
    v.addEventListener('loadedmetadata', read);
    return () => v.removeEventListener('loadedmetadata', read);
  }, []);

  const suggestion = useMemo(
    () => suggestCaptionStyle(extractCaptionSignals(cues, speakerMap, dims)),
    [cues, speakerMap, dims],
  );

  if (!suggestion || dismissed) return null;

  const applied = currentTemplate === suggestion.presetKey;

  return (
    <div className="relative rounded-xl border border-primary/30 bg-primary/[0.06] p-3 pr-9">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="추천 닫기"
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition hover:bg-white/5 hover:text-foreground"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base leading-none" aria-hidden>✨</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            추천 스타일: <span className="text-primary">{suggestion.presetLabel}</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {suggestion.reasons.map((r, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-muted-foreground">
                · {r}
              </li>
            ))}
          </ul>
          {suggestion.hint && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-500/90">💡 {suggestion.hint}</p>
          )}

          <button
            type="button"
            onClick={() => applyTemplate(suggestion.presetKey)}
            disabled={applied}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-default disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
          >
            {applied ? '✓ 적용됨' : '✨ 추천 적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
