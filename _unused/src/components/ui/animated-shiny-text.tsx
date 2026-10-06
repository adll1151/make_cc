import { cn } from '@/lib/utils';
import type { CSSProperties, ComponentPropsWithoutRef } from 'react';

/** Magic UI — AnimatedShinyText. 텍스트 위를 빛이 훑고 지나간다. */
interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<'span'> {
  shimmerWidth?: number;
}

export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
  ...props
}: AnimatedShinyTextProps) {
  return (
    <span
      style={{ '--shiny-width': `${shimmerWidth}px` } as CSSProperties}
      className={cn(
        'mx-auto max-w-md text-muted-foreground/70',
        'animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]',
        'bg-gradient-to-r from-transparent via-foreground/90 via-50% to-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
