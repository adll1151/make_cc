'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

/** React Bits — Magnet. 자식이 커서에 끌려온다(반경 padding 안에서). */
export function Magnet({
  children,
  padding = 80,
  magnetStrength = 3,
  className,
}: {
  children: ReactNode;
  padding?: number;
  magnetStrength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !window.matchMedia('(pointer: fine)').matches
      )
        return;
    }
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const cx = left + width / 2;
      const cy = top + height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.abs(dx) < width / 2 + padding && Math.abs(dy) < height / 2 + padding) {
        setActive(true);
        setPos({ x: dx / magnetStrength, y: dy / magnetStrength });
      } else if (active) {
        setActive(false);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [active, padding, magnetStrength]);

  return (
    <div ref={ref} className={className} style={{ display: 'inline-block' }}>
      <div
        style={
          {
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
            transition: active ? 'transform 0.1s ease-out' : 'transform 0.4s var(--ease-out-expo)',
            willChange: 'transform',
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
