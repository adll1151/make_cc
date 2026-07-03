'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { useCaptionStyle } from '../hooks/useCaptionStyle';
import { extractCaptionSignals } from '../lib/caption-signals';
import { suggestCaptionStyle } from '../lib/caption-suggest';
import { sampleFrameSignals } from '../lib/frame-sampler';
import type { CaptionBand, FrameSignals } from '../lib/frame-analysis';

/**
 * 자막 스타일 어시 — 영상·자막을 분석해 어울리는 번인 프리셋을 추천.
 *
 * Tier 1(메타데이터 휴리스틱)은 즉시, Tier 2(프레임 픽셀 분석)는 비동기로 완료 시
 * 색/박스/위치 보정을 덧붙인다(progressive enhancement). 전부 순수 클라이언트·$0.
 * 제안만 하고 강제하지 않으며, 신호 부족/분석 실패 시 무해하게 Tier 1로 강등한다.
 */
export function CaptionSuggestion() {
  const cues = useSubtitleStore((s) => s.cues);
  const speakerMap = useSubtitleStore((s) => s.speakerMap);
  const position = useCaptionStyle((s) => s.style.position);
  const applyTemplate = useCaptionStyle((s) => s.applyTemplate);
  const patchStyle = useCaptionStyle((s) => s.patchStyle);

  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frameSignals, setFrameSignals] = useState<FrameSignals | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  // 편집기 영상 엘리먼트에서 종횡비 + 소스 URL 읽기.
  // 주의: 편집기 로딩 중엔 videoUrl이 null이라 <video>가 아직 DOM에 없다(늦게 렌더).
  // 또 loadedmetadata를 놓칠 수도 있다. → 매 틱 video 엘리먼트를 재조회하며 폴링해
  // 요소가 나중에 나타나도, 이벤트를 놓쳐도 견고하게 dims/url을 얻는다.
  useEffect(() => {
    let gotDims = false;
    const read = () => {
      const v = document.querySelector('video');
      if (!v) return;
      const url = v.currentSrc || v.src;
      if (url) setVideoUrl(url);
      if (!gotDims && v.videoWidth > 0 && v.videoHeight > 0) {
        gotDims = true;
        setDims({ width: v.videoWidth, height: v.videoHeight });
        clearInterval(poll);
      }
    };
    read();
    const poll = setInterval(read, 250);
    const stop = setTimeout(() => clearInterval(poll), 10000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, []);

  // 자막 밴드 = 현재 자막 위치 기준. 'middle'은 'bottom'으로 매핑 (Design §10.3)
  const band: CaptionBand = position === 'top' ? 'top' : 'bottom';

  // 프레임 샘플링: (videoUrl, band) 1회만. cues 의존 금지(키 입력마다 재발화 방지 §10.6)
  useEffect(() => {
    if (!videoUrl || !dims) return;
    const controller = new AbortController();
    let alive = true;
    setFrameSignals(null);
    sampleFrameSignals(videoUrl, { band, signal: controller.signal })
      .then((fs) => {
        if (alive) setFrameSignals(fs);
      })
      .catch(() => {
        /* 무해 강등 — Tier 1 유지 */
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [videoUrl, band, dims]);

  const suggestion = useMemo(
    () => suggestCaptionStyle(extractCaptionSignals(cues, speakerMap, dims), frameSignals),
    [cues, speakerMap, dims, frameSignals],
  );

  // 새 추천/영상이면 적용 상태 리셋
  useEffect(() => {
    setApplied(false);
  }, [suggestion?.presetKey, videoUrl]);

  if (!suggestion || dismissed) return null;

  const handleApply = () => {
    applyTemplate(suggestion.presetKey);
    if (suggestion.stylePatch) patchStyle(suggestion.stylePatch);
    setApplied(true);
  };

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
            {suggestion.patchReasons?.map((r, i) => (
              <li key={`p${i}`} className="text-[11px] leading-relaxed text-primary/80">
                ◆ {r}
              </li>
            ))}
          </ul>
          {suggestion.hint && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-500/90">💡 {suggestion.hint}</p>
          )}

          <button
            type="button"
            onClick={handleApply}
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
