'use client';

import { useEffect, useRef, useState, type ElementType } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { cn } from '@/lib/utils';

/** React Bits — BlurText. 단어가 블러→선명 + 슬라이드 인.
 *  scroll=true면 스크롤에 연동(내리면 작동, 올리면 반대로). 아니면 진입 시 1회. */
interface BlurTextProps {
  text?: string;
  delay?: number;
  delayStart?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  as?: ElementType;
  scroll?: boolean;
}

export function BlurText({
  text = '',
  delay = 110,
  delayStart = 0,
  className = '',
  animateBy = 'words',
  direction = 'top',
  as: Tag = 'span',
  scroll = false,
}: BlurTextProps) {
  const elements = animateBy === 'words' ? text.split(' ') : Array.from(text);
  const y = direction === 'top' ? -18 : 18;

  if (scroll) {
    return (
      <ScrollBlur elements={elements} className={className} as={Tag} y={y} animateBy={animateBy} />
    );
  }
  return (
    <OnceBlur
      elements={elements}
      className={className}
      as={Tag}
      y={y}
      delay={delay}
      delayStart={delayStart}
      animateBy={animateBy}
    />
  );
}

/* 진입 시 1회 */
function OnceBlur({
  elements,
  className,
  as: Tag,
  y,
  delay,
  delayStart,
  animateBy,
}: {
  elements: string[];
  className: string;
  as: ElementType;
  y: number;
  delay: number;
  delayStart: number;
  animateBy: 'words' | 'letters';
}) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e?.isIntersecting && (setInView(true), io.disconnect()),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const from = { filter: 'blur(10px)', opacity: 0, y };
  const to = { filter: 'blur(0px)', opacity: 1, y: 0 };
  return (
    <Tag ref={ref} className={cn('inline-flex flex-wrap', className)}>
      {elements.map((seg, i) => (
        <motion.span
          key={i}
          className="inline-block whitespace-pre will-change-[transform,filter,opacity]"
          initial={from}
          animate={inView ? to : from}
          transition={{ duration: 0.5, delay: (delayStart + i * delay) / 1000, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {seg}
          {animateBy === 'words' && i < elements.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}

/* 스크롤 연동(가역) */
function ScrollBlur({
  elements,
  className,
  as: Tag,
  y,
  animateBy,
}: {
  elements: string[];
  className: string;
  as: ElementType;
  y: number;
  animateBy: 'words' | 'letters';
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: ['start 0.95', 'start 0.55'],
  });
  return (
    <Tag ref={ref} className={cn('inline-flex flex-wrap', className)}>
      {elements.map((seg, i) => (
        <ScrollWord
          key={i}
          progress={scrollYProgress}
          index={i}
          total={elements.length}
          y={y}
        >
          {seg}
          {animateBy === 'words' && i < elements.length - 1 ? ' ' : ''}
        </ScrollWord>
      ))}
    </Tag>
  );
}

function ScrollWord({
  progress,
  index,
  total,
  y,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  y: number;
  children: React.ReactNode;
}) {
  const span = 1 / Math.max(total, 1);
  const start = index * span * 0.6;
  const end = Math.min(1, start + span * 1.6 + 0.15);
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const ty = useTransform(progress, [start, end], [y, 0]);
  const blur = useTransform(progress, [start, end], [10, 0]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  return (
    <motion.span
      style={{ opacity, y: ty, filter }}
      className="inline-block whitespace-pre will-change-[transform,filter,opacity]"
    >
      {children}
    </motion.span>
  );
}
