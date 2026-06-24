import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef, CSSProperties } from 'react';

/** Magic UI — Marquee. 무한 가로 스크롤 스트립. */
interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
  duration?: string;
  gap?: string;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  repeat = 4,
  duration = '40s',
  gap = '1rem',
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      style={{ '--mq-duration': duration, '--mq-gap': gap } as CSSProperties}
      className={cn('group flex flex-row overflow-hidden', className)}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 flex-row items-center justify-around animate-marquee-h',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]',
          )}
          style={{ gap, paddingLeft: gap }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
