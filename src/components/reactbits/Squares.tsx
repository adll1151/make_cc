'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** React Bits — Squares. 천천히 흐르는 격자 배경 + 호버 칸 강조. */
export function Squares({
  direction = 'diagonal',
  speed = 0.4,
  squareSize = 46,
  borderColor = 'rgba(120,120,135,0.13)',
  hoverFillColor = 'rgba(224,168,90,0.10)',
  className,
}: {
  direction?: 'up' | 'down' | 'left' | 'right' | 'diagonal';
  speed?: number;
  squareSize?: number;
  borderColor?: string;
  hoverFillColor?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    const offset = { x: 0, y: 0 };
    const hover = { x: -1, y: -1 };

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left + offset.x;
      const my = e.clientY - r.top + offset.y;
      hover.x = Math.floor(mx / squareSize);
      hover.y = Math.floor(my / squareSize);
    };
    const onLeave = () => {
      hover.x = -1;
      hover.y = -1;
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const startX = Math.floor(offset.x / squareSize) * squareSize;
      const startY = Math.floor(offset.y / squareSize) * squareSize;
      for (let x = startX; x < startX + w + squareSize; x += squareSize) {
        for (let y = startY; y < startY + h + squareSize; y += squareSize) {
          const sx = x - offset.x;
          const sy = y - offset.y;
          if (hover.x === Math.floor(x / squareSize) && hover.y === Math.floor(y / squareSize)) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(sx, sy, squareSize, squareSize);
          }
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, squareSize, squareSize);
        }
      }
    };

    let raf = 0;
    const loop = () => {
      if (!reduce) {
        const e = Math.max(speed, 0.1);
        if (direction === 'right') offset.x = (offset.x - e + squareSize) % squareSize;
        else if (direction === 'left') offset.x = (offset.x + e) % squareSize;
        else if (direction === 'up') offset.y = (offset.y + e) % squareSize;
        else if (direction === 'down') offset.y = (offset.y - e + squareSize) % squareSize;
        else {
          offset.x = (offset.x + e) % squareSize;
          offset.y = (offset.y + e) % squareSize;
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [direction, speed, squareSize, borderColor, hoverFillColor]);

  return <canvas ref={canvasRef} className={cn('size-full', className)} aria-hidden />;
}
