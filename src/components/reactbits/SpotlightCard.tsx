'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** React Bits — SpotlightCard. 커서를 따라 빛나는 스포트라이트 카드. */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'color-mix(in oklab, var(--color-accent) 22%, transparent)',
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };

  return (
    <div ref={ref} onMouseMove={onMove} className={cn('group relative overflow-hidden', className)}>
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle 220px at var(--sx, 50%) var(--sy, 50%), ${spotlightColor}, transparent 70%)`,
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
