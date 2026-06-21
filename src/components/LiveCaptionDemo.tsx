'use client';

import { useEffect, useState } from 'react';

/**
 * 히어로용 "실시간 자막 생성" 데모 애니메이션.
 * 한국어 문장이 타이핑되며 나타나고(자막 생성 시뮬), 파형이 계속 움직인다.
 * 제품의 핵심(올리면 자막이 뚝딱)을 모션으로 보여줌. 순수 CSS+타이머, 가벼움.
 */
const LINES = [
  '안녕하세요, 한국어 자막 데모입니다',
  '영상을 올리면 자막이 자동으로 만들어져요',
  '편집하고 영상에 박아 내보낼 수 있어요',
];

const TYPE_MS = 55; // 글자당 타이핑 속도
const HOLD_MS = 1700; // 한 줄 완성 후 머무는 시간

export function LiveCaptionDemo() {
  const [lineIdx, setLineIdx] = useState(0);
  const [count, setCount] = useState(0);
  const line = LINES[lineIdx]!;

  useEffect(() => {
    if (count < line.length) {
      const t = setTimeout(() => setCount((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setCount(0);
      setLineIdx((i) => (i + 1) % LINES.length);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [count, line.length]);

  return (
    <div className="bento relative mx-auto aspect-video w-full max-w-md overflow-hidden p-0">
      {/* 영상 영역(그라데이션) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--aurora-purple)]/25 via-background to-[var(--aurora-magenta)]/20" />
      <div className="grain-overlay" aria-hidden />

      {/* 처리 중 인디케이터 */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs backdrop-blur-md">
        <span className="size-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <span className="text-muted-foreground">자막 생성 중</span>
      </div>

      {/* 자막 (타이핑) */}
      <div className="absolute inset-x-4 bottom-16 flex justify-center">
        <p className="max-w-[88%] text-balance text-center text-lg font-semibold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
          {line.slice(0, count)}
          <span className="ml-0.5 inline-block w-[2px] animate-pulse-glow self-stretch bg-accent align-middle">
            &nbsp;
          </span>
        </p>
      </div>

      {/* 파형 (계속 움직임) */}
      <div className="absolute inset-x-0 bottom-5 flex items-end justify-center gap-[3px]">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-[var(--aurora-purple)] to-[var(--aurora-magenta)] opacity-80"
            style={{
              height: `${8 + ((i * 13) % 26)}px`,
              animation: `float ${1.1 + (i % 5) * 0.25}s ease-in-out infinite`,
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
