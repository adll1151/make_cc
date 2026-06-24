'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';
import { cn } from '@/lib/utils';

/** React Bits — CountUp. 화면에 들어오면 from→to로 카운트업(spring). */
interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  separator?: string;
}

export function CountUp({
  to,
  from = 0,
  duration = 1.6,
  delay = 0,
  className,
  prefix = '',
  suffix = '',
  separator = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(from);
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const spring = useSpring(mv, { damping, stiffness });
  const inView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (ref.current) ref.current.textContent = `${prefix}${from}${suffix}`;
  }, [from, prefix, suffix]);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => mv.set(to), delay * 1000);
    return () => clearTimeout(t);
  }, [inView, mv, to, delay]);

  useEffect(() => {
    return spring.on('change', (v) => {
      if (!ref.current) return;
      let n = Intl.NumberFormat('ko-KR').format(Math.round(v));
      if (separator) n = n.replace(/,/g, separator);
      ref.current.textContent = `${prefix}${n}${suffix}`;
    });
  }, [spring, prefix, suffix, separator]);

  return <span ref={ref} className={cn('inline-block tabular-nums', className)} />;
}
