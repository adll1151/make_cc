'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 포인터 패럴럭스 — 마우스 위치를 정규화(-1~1)해 CSS 변수 --px/--py로 노출.
 * 자식들은 globals.css의 .prlx-1/2/3 클래스로 서로 다른 깊이만큼 따라 움직인다.
 *
 * - rAF 스로틀, prefers-reduced-motion / 터치 환경 비활성.
 * - 레이아웃 영향 없음(자식 transform만).
 */
export function Parallax({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      target.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
      if (!raf.current) {
        raf.current = requestAnimationFrame(apply);
      }
    };
    const apply = () => {
      raf.current = 0;
      el.style.setProperty('--px', target.current.x.toFixed(3));
      el.style.setProperty('--py', target.current.y.toFixed(3));
    };
    const onLeave = () => {
      target.current = { x: 0, y: 0 };
      el.style.setProperty('--px', '0');
      el.style.setProperty('--py', '0');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
