'use client';

import { useEffect, useRef } from 'react';

/**
 * 히어로 헤드라인 — "영상 올리면, [자막이 됩니다]".
 * 단어가 blur→sharp로 아래에서 차례로 떠오르며(word cascade blur-in, 2026 트렌드),
 * 마지막에 강조구 밑줄이 왼→오로 그려진다.
 *
 * 왜 WAAPI(element.animate)인가: globals.css의 reduced-motion 전역 규칙이
 * 모든 "CSS" 애니메이션을 강제 정지시킨다(animation-duration:0.01ms !important).
 * WAAPI는 이 규칙의 영향을 받지 않으므로, reduce에서도 "정지"가 아니라
 * 부드러운 페이드로 살아있게 만든다(모션 민감 사용자에겐 이동/블러를 줄인 버전).
 */
const WORDS: { t: string; accent?: boolean }[] = [
  { t: '영상' },
  { t: '올리면,' },
  { t: '자막이', accent: true },
  { t: '됩니다.', accent: true },
];

export function TranscribeHeadline({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const words = root.querySelectorAll<HTMLElement>('[data-w]');
    const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

    words.forEach((w, i) => {
      const from = reduce
        ? { opacity: 0 }
        : { opacity: 0, transform: 'translateY(0.42em)', filter: 'blur(12px)' };
      const to = reduce
        ? { opacity: 1 }
        : { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' };
      w.animate([from, to], {
        duration: reduce ? 420 : 640,
        delay: 100 + i * 90,
        easing: EASE,
        fill: 'both',
      });
    });

    const underline = root.querySelector<HTMLElement>('[data-underline]');
    underline?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: 560,
      delay: 100 + WORDS.length * 90 + 120,
      easing: EASE,
      fill: 'both',
    });
  }, []);

  return (
    <h1 ref={ref} className={className}>
      {WORDS.map((w, i) => (
        <span key={i} data-w className="inline-block will-change-[transform,filter,opacity]">
          {w.accent ? (
            <span className="relative text-accent">
              {w.t}
              {i === WORDS.length - 1 && (
                <span
                  data-underline
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 h-[0.14em] origin-left rounded-full bg-accent/40"
                  style={{ transform: 'scaleX(0)' }}
                />
              )}
            </span>
          ) : (
            w.t
          )}
          {i < WORDS.length - 1 && ' '}
        </span>
      ))}
    </h1>
  );
}
