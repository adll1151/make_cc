'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 화면에 들어오면 숫자가 0 → 목표값으로 카운트업하는 통계용 컴포넌트.
 * "< 15%", "3분", "100+", "₩0" 처럼 접두/접미 기호가 붙은 문자열을 파싱해
 * 가운데 숫자만 애니메이션한다. IntersectionObserver로 보일 때 1회만 실행.
 */
export function CountUp({ value, duration = 1200 }: { value: string; duration?: number }) {
  const match = value.match(/^(\D*)(\d[\d,]*)(.*)$/);
  const prefix = match?.[1] ?? '';
  const target = match ? Number((match[2] ?? '0').replace(/,/g, '')) : 0;
  const suffix = match?.[3] ?? '';

  const [display, setDisplay] = useState(match ? 0 : value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!match) return; // 숫자 없는 문자열은 그대로
    const el = ref.current;
    if (!el) return;

    // 모션 최소화 설정이면 즉시 목표값
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        let raf = 0;
        let startTs = 0;
        const step = (ts: number) => {
          if (!startTs) startTs = ts;
          const p = Math.min(1, (ts - startTs) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setDisplay(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [match, target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {typeof display === 'number' ? display.toLocaleString('en-US') : display}
      {suffix}
    </span>
  );
}
