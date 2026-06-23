import { cn } from '@/lib/utils';
import type { CSSProperties, ReactNode } from 'react';

/** React Bits — GradientText. 흐르는 그라데이션 텍스트. */
export function GradientText({
  children,
  className,
  colors = ['var(--color-accent)', 'oklch(0.72 0.17 40)', 'var(--aurora-amber)', 'var(--color-accent)'],
  speed = 6,
}: {
  children: ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}) {
  return (
    <span
      className={cn('inline-block bg-clip-text', className)}
      style={
        {
          color: 'transparent',
          WebkitBackgroundClip: 'text',
          backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
          backgroundSize: '200% 100%',
          animation: `gradient-move ${speed}s linear infinite`,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
