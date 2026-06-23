'use client';

import { useRef, type ReactNode, type MouseEvent } from 'react';

/**
 * 마그네틱 효과 — 자식(보통 버튼/CTA)이 커서를 살짝 따라온다.
 * 2026 트렌드 "premium SaaS" 시그니처 마이크로 인터랙션.
 *
 * - inline-block 래퍼라 레이아웃에 영향 없이 transform만 이동.
 * - prefers-reduced-motion 또는 터치(coarse) 환경에선 비활성.
 * - strength: 끌림 강도(0~1). 기본 0.4(과감).
 */
export function Magnetic({
  children,
  strength = 0.4,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const handleMove = (e: MouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;
    }
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };

  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0px, 0px)';
  };

  return (
    <span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={className}
      style={{
        display: 'inline-block',
        willChange: 'transform',
        transition: 'transform 0.3s var(--ease-out-expo)',
      }}
    >
      {children}
    </span>
  );
}
