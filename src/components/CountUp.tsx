'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 화면에 들어오면 숫자가 0 → 목표값으로 카운트업하는 통계용 컴포넌트.
 * "< 15%", "3분", "100+", "₩0" 처럼 접두/접미 기호가 붙은 문자열을 파싱해
 * 가운데 숫자만 애니메이션한다. IntersectionObserver로 보일 때 **1회만** 실행.
 *
 * 주의: 의존성은 원시값(value, duration)만. match 같은 객체를 deps에 넣으면
 * 매 렌더마다 새 참조 → effect 재실행 → 애니메이션 무한 재시작 버그가 난다.
 */
function parse(value: string): { prefix: string; target: number; suffix: string; hasNumber: boolean } {
  const m = value.match(/^(\D*)(\d[\d,]*)(.*)$/);
  if (!m) return { prefix: '', target: 0, suffix: '', hasNumber: false };
  return {
    prefix: m[1] ?? '',
    target: Number((m[2] ?? '0').replace(/,/g, '')),
    suffix: m[3] ?? '',
    hasNumber: true,
  };
}

export function CountUp({ value, duration = 1200 }: { value: string; duration?: number }) {
  const { prefix, target, suffix, hasNumber } = parse(value);

  const [display, setDisplay] = useState(hasNumber ? 0 : null);
  const ref = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false); // 한 번 끝나면 다시 실행하지 않음

  useEffect(() => {
    if (!hasNumber || doneRef.current) return;
    const el = ref.current;
    if (!el) return;

    // 모션 최소화 설정이면 즉시 목표값
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current = true;
      setDisplay(target);
      return;
    }

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || doneRef.current) return;
        doneRef.current = true;
        io.disconnect();
        let startTs = 0;
        const step = (ts: number) => {
          if (!startTs) startTs = ts;
          const p = Math.min(1, (ts - startTs) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setDisplay(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, target, duration, hasNumber]);

  return (
    <span ref={ref}>
      {hasNumber ? (
        <>
          {prefix}
          {(display ?? 0).toLocaleString('en-US')}
          {suffix}
        </>
      ) : (
        value
      )}
    </span>
  );
}
