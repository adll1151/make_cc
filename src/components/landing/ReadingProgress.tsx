'use client';

import { useEffect, useRef } from 'react';

/**
 * 상단 읽기 진행 바 — 히어로 캡션 스크러버와 동일 톤.
 * 스크롤 위치를 자막 타임라인처럼 보여줘 정체성을 페이지 끝까지 잇는다.
 * JS 구동(ref scaleX)이라 reduced-motion에서도 정확히 작동.
 */
export function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
        if (ref.current) ref.current.style.transform = `scaleX(${p.toFixed(4)})`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px]" aria-hidden>
      <div
        ref={ref}
        className="h-full origin-left rounded-r-full bg-accent"
        style={{ transform: 'scaleX(0)', boxShadow: '0 0 8px color-mix(in oklab, var(--color-accent) 70%, transparent)' }}
      />
    </div>
  );
}
