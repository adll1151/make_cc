'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Magic UI — Particles. 캔버스에 떠다니는 입자 + 마우스 반응. */
interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  color?: string;
  vx?: number;
  vy?: number;
  style?: CSSProperties;
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const int = parseInt(hex, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

export function Particles({
  className,
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  color = '#ffffff',
  vx = 0,
  vy = 0,
  style,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;
  const rafID = useRef<number | null>(null);
  const [rgb] = useState<number[]>(() => hexToRgb(color));

  useEffect(() => {
    if (canvasRef.current) context.current = canvasRef.current.getContext('2d');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const resize = () => {
      const c = containerRef.current;
      const canvas = canvasRef.current;
      if (!c || !canvas || !context.current) return;
      circles.current = [];
      canvasSize.current.w = c.offsetWidth;
      canvasSize.current.h = c.offsetHeight;
      canvas.width = canvasSize.current.w * dpr;
      canvas.height = canvasSize.current.h * dpr;
      canvas.style.width = `${canvasSize.current.w}px`;
      canvas.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
      for (let i = 0; i < quantity; i++) circles.current.push(makeCircle());
    };

    const makeCircle = (): Circle => {
      const x = Math.floor(Math.random() * canvasSize.current.w);
      const y = Math.floor(Math.random() * canvasSize.current.h);
      return {
        x,
        y,
        translateX: 0,
        translateY: 0,
        size: Math.floor(Math.random() * 2) + size,
        alpha: 0,
        targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
        dx: (Math.random() - 0.5) * 0.1,
        dy: (Math.random() - 0.5) * 0.1,
        magnetism: 0.1 + Math.random() * 4,
      };
    };

    const drawCircle = (c: Circle) => {
      if (!context.current) return;
      context.current.translate(c.translateX, c.translateY);
      context.current.beginPath();
      context.current.arc(c.x, c.y, c.size, 0, 2 * Math.PI);
      context.current.fillStyle = `rgba(${rgb.join(', ')}, ${c.alpha})`;
      context.current.fill();
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const animate = () => {
      if (!context.current) return;
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
      circles.current.forEach((c, i) => {
        const edge = [
          c.x + c.translateX - c.size,
          canvasSize.current.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          canvasSize.current.h - c.y - c.translateY - c.size,
        ];
        const closest = Math.min(...edge);
        const remap = Math.max(0, Math.min(1, parseFloat((closest / 20).toFixed(2))));
        c.alpha += remap > 1 ? 0.02 : (c.targetAlpha * remap - c.alpha) * 0.05;
        if (c.alpha > c.targetAlpha) c.alpha = c.targetAlpha;
        c.x += c.dx + vx;
        c.y += c.dy + vy;
        c.translateX += (mouse.current.x / (staticity / c.magnetism) - c.translateX) / ease;
        c.translateY += (mouse.current.y / (staticity / c.magnetism) - c.translateY) / ease;
        drawCircle(c);
        if (
          c.x < -c.size ||
          c.x > canvasSize.current.w + c.size ||
          c.y < -c.size ||
          c.y > canvasSize.current.h + c.size
        ) {
          circles.current[i] = makeCircle();
        }
      });
      rafID.current = window.requestAnimationFrame(animate);
    };

    const onMouse = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { w, h } = canvasSize.current;
      const x = e.clientX - rect.left - w / 2;
      const y = e.clientY - rect.top - h / 2;
      if (Math.abs(x) < w / 2 && Math.abs(y) < h / 2) {
        mouse.current.x = x;
        mouse.current.y = y;
      }
    };

    resize();
    animate();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);
    return () => {
      if (rafID.current != null) window.cancelAnimationFrame(rafID.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, [color, quantity, staticity, ease, size, vx, vy, dpr, rgb]);

  return (
    <div ref={containerRef} className={cn('pointer-events-none', className)} style={style} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
