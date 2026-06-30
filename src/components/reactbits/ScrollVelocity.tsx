'use client';

import { useRef } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import { cn } from '@/lib/utils';

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/** React Bits — ScrollVelocity. 스크롤 속도/방향에 반응해 가속·역행하며 흐르는 텍스트 띠. */
export function ScrollVelocity({
  items,
  velocity = 3,
  className,
  itemClassName,
}: {
  items: string[];
  velocity?: number;
  className?: string;
  itemClassName?: string;
}) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smooth = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 5], { clamp: false });
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`);
  const dir = useRef(1);

  useAnimationFrame((_, delta) => {
    let moveBy = dir.current * velocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    moveBy += dir.current * moveBy * f;
    baseX.set(baseX.get() + moveBy);
  });

  const Row = () => (
    <span className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className={cn('mx-7 inline-flex items-center gap-7', itemClassName)}>
          {it}
          <span className="size-1.5 rounded-full bg-accent" />
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]',
        className,
      )}
    >
      <motion.div className="flex whitespace-nowrap" style={{ x }}>
        <Row />
        <Row />
        <Row />
        <Row />
      </motion.div>
    </div>
  );
}
