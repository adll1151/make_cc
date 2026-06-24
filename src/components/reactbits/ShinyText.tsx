import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

/** React Bits — ShinyText. 텍스트 위로 빛이 훑고 지나간다. */
export function ShinyText({
  text,
  speed = 5,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block bg-clip-text', className)}
      style={
        {
          color: 'transparent',
          WebkitBackgroundClip: 'text',
          backgroundImage:
            'linear-gradient(110deg, var(--color-accent) 42%, oklch(0.88 0.12 85) 50%, var(--color-accent) 58%)',
          backgroundSize: '200% 100%',
          animation: `shine-move ${speed}s linear infinite`,
        } as CSSProperties
      }
    >
      {text}
    </span>
  );
}
