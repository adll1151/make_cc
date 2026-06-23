import React, { type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Magic UI — ShimmerButton. 테두리를 빛이 도는 CTA 버튼. */
export interface ShimmerButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = 'var(--color-accent)',
      shimmerSize = '0.06em',
      shimmerDuration = '3s',
      borderRadius = '100px',
      background = 'var(--color-primary)',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
          } as CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-foreground/10 px-7 py-3.5 text-base font-semibold text-primary-foreground [background:var(--bg)] [border-radius:var(--radius)]',
          'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
          className,
        )}
        {...props}
      >
        {/* spark container */}
        <div
          className={cn(
            '-z-30 blur-[2px]',
            'absolute inset-0 overflow-visible [container-type:size]',
          )}
        >
          <div className="absolute inset-0 h-[100cqh] animate-spin-around [aspect-ratio:1] [border-radius:0] [mask:none]">
            <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
          </div>
        </div>
        {children}

        {/* highlight */}
        <div
          className={cn(
            'insert-0 absolute size-full',
            'rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]',
            'transform-gpu transition-all duration-300 ease-in-out',
            'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
            'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]',
          )}
          style={{ borderRadius: 'var(--radius)' }}
        />
        {/* backdrop */}
        <div
          className="absolute -z-20 [background:var(--bg)] [inset:var(--cut)]"
          style={{ borderRadius: 'var(--radius)' }}
        />
      </button>
    );
  },
);
ShimmerButton.displayName = 'ShimmerButton';
