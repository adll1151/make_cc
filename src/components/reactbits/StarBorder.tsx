import { cn } from '@/lib/utils';
import type { CSSProperties, ReactNode } from 'react';

/** React Bits — StarBorder. 테두리를 따라 별빛이 도는 래퍼. */
export function StarBorder({
  children,
  className,
  color = 'var(--color-accent)',
  speed = '5s',
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  speed?: string;
}) {
  return (
    <div
      className={cn('relative inline-block overflow-hidden rounded-full p-[1.5px]', className)}
      style={{ '--sb-speed': speed } as CSSProperties}
    >
      <div
        className="absolute right-[-250%] bottom-[-12px] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animation: 'star-move-bottom var(--sb-speed) linear infinite alternate',
        }}
      />
      <div
        className="absolute left-[-250%] top-[-12px] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animation: 'star-move-top var(--sb-speed) linear infinite alternate',
        }}
      />
      <div className="relative z-10 rounded-full">{children}</div>
    </div>
  );
}
