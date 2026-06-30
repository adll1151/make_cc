'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Aceternity — Background Gradient Animation. 유기적으로 뭉쳐 흐르는 그라데이션 블롭(라바램프).
 * 따뜻한 앰버 계열로 톤 다운(브랜드 응집). interactive 블롭은 커서를 따라온다.
 */
export function BackgroundGradientAnimation({
  className,
  interactive = true,
}: {
  className?: string;
  interactive?: boolean;
}) {
  const interactiveRef = useRef<HTMLDivElement>(null);
  const cur = useRef({ x: 0, y: 0 });
  const tgt = useRef({ x: 0, y: 0 });
  // 모바일/터치/저전력 기기에선 SVG goo 필터 + blur + 블롭 애니메이션이
  // 매 프레임 전체화면을 재래스터화해 깜빡임을 유발 → 정적 모드로 전환.
  const [lite, setLite] = useState(false);

  useEffect(() => {
    setLite(
      window.matchMedia(
        '(prefers-reduced-motion: reduce), (max-width: 820px), (pointer: coarse)',
      ).matches,
    );
  }, []);

  useEffect(() => {
    if (!interactive || lite) return;
    let raf = 0;
    const move = () => {
      const el = interactiveRef.current;
      if (el) {
        cur.current.x += (tgt.current.x - cur.current.x) / 20;
        cur.current.y += (tgt.current.y - cur.current.y) / 20;
        el.style.transform = `translate(${Math.round(cur.current.x)}px, ${Math.round(cur.current.y)}px)`;
      }
      raf = requestAnimationFrame(move);
    };
    const onMove = (e: MouseEvent) => {
      const el = interactiveRef.current?.parentElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      tgt.current = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
    };
    raf = requestAnimationFrame(move);
    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [interactive, lite]);

  // 따뜻한 앰버 계열 블롭 (단색 가족 → 응집)
  const blob = (rgba: string): CSSProperties => ({
    position: 'absolute',
    background: `radial-gradient(circle at center, ${rgba} 0, transparent 50%)`,
    mixBlendMode: 'multiply',
    width: '80%',
    height: '80%',
    top: '10%',
    left: '10%',
  });

  return (
    <div
      className={cn('h-full w-full overflow-hidden', className)}
      style={{ background: 'linear-gradient(40deg, oklch(0.985 0.004 80), oklch(0.97 0.01 70))' }}
    >
      <svg className="hidden">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div
        className="h-full w-full"
        style={{ filter: lite ? 'none' : 'url(#goo) blur(28px)' }}
      >
        <div style={{ ...blob('rgba(224,168,90,0.55)'), animation: lite ? undefined : 'moveVertical 30s ease infinite' }} />
        <div style={{ ...blob('rgba(240,150,90,0.5)'), transformOrigin: 'calc(50% - 400px)', animation: lite ? undefined : 'moveInCircle 22s reverse infinite' }} />
        <div style={{ ...blob('rgba(245,200,120,0.55)'), top: '20%', left: '20%', transformOrigin: 'calc(50% + 400px)', animation: lite ? undefined : 'moveInCircle 40s linear infinite' }} />
        <div style={{ ...blob('rgba(235,170,110,0.45)'), transformOrigin: 'calc(50% - 200px)', animation: lite ? undefined : 'moveHorizontal 40s ease infinite' }} />
        <div style={{ ...blob('rgba(255,210,150,0.55)'), width: '100%', height: '100%', top: '0', left: '0', transformOrigin: 'calc(50% - 800px) calc(50% + 200px)', animation: lite ? undefined : 'moveInCircle 20s ease infinite' }} />
        {interactive && !lite && (
          <div
            ref={interactiveRef}
            className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 opacity-70"
            style={{
              background: 'radial-gradient(circle at center, rgba(224,168,90,0.5) 0, transparent 50%)',
              mixBlendMode: 'multiply',
            }}
          />
        )}
      </div>
    </div>
  );
}
