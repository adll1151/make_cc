'use client';

import { useEffect, useState } from 'react';

/**
 * 랜딩 "브라우저 편집기" 카드용 미니 편집기 애니메이션.
 * 실제 편집기처럼 cue 리스트에서 활성 자막이 순환하며 강조되고, 활성 줄엔 커서가 깜빡인다.
 * 순수 CSS+타이머라 가볍다.
 */
const CUES = [
  { t: '0:01', text: '안녕하세요, 자막이에요' },
  { t: '0:03', text: '여기서 바로 수정하고' },
  { t: '0:05', text: '미리보기까지 실시간' },
];

export function EditorDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % CUES.length), 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute right-4 top-4 w-[210px] space-y-1.5">
      {CUES.map((c, i) => {
        const on = active === i;
        return (
          <div
            key={i}
            className={[
              'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all duration-500',
              on
                ? 'border-primary/40 bg-primary/10 shadow-[var(--shadow-glow)]'
                : 'border-border/50 bg-card/40 opacity-60',
            ].join(' ')}
          >
            <span
              className={[
                'shrink-0 font-mono text-[9px] tabular-nums',
                on ? 'text-primary' : 'text-muted-foreground/50',
              ].join(' ')}
            >
              {c.t}
            </span>
            <span className="truncate text-[11px] text-foreground/90">
              {c.text}
              {on && (
                <span className="ml-0.5 inline-block h-[11px] w-[2px] animate-pulse-glow rounded-full bg-accent align-middle" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
