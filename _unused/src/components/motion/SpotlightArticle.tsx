'use client';

import { type ReactNode, type MouseEvent } from 'react';

/**
 * 커서 추적 스포트라이트 카드 — 마우스 위치를 CSS 변수(--mx/--my)로 노출.
 * globals.css의 bento spotlight(radial-gradient at var(--mx) var(--my))가 이를 받아
 * 커서를 따라 빛난다. 호버 시에만 보이도록 그라데이션 div는 opacity로 제어(소비 측).
 *
 * BentoCard 같은 서버 컴포넌트가 바깥 <article>을 이 클라이언트 컴포넌트로 위임.
 */
export function SpotlightArticle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const handleMove = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 커서 스포트라이트 위치
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    // 3D 틸트 (절제된 각도) — 터치/모션감소 환경 제외
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;
    }
    const rx = (y / rect.height - 0.5) * -5;
    const ry = (x / rect.width - 0.5) * 5;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  };

  const reset = (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <article
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </article>
  );
}
