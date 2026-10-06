'use client';

import { Fragment, useEffect, useState, type CSSProperties } from 'react';

/** make_cc 전체 사이클 — 업로드부터 공유까지 한눈에. */
const STEPS = [
  { icon: '📤', title: '업로드', desc: '영상을 끌어다 놓기' },
  { icon: '🎙️', title: '음성 인식', desc: 'Whisper로 자동 STT', wave: true },
  { icon: '✍️', title: '자막 편집', desc: '브라우저에서 바로' },
  { icon: '🎬', title: '내보내기', desc: 'SRT · 번인 영상' },
  { icon: '🔗', title: '공유', desc: '링크 한 줄로' },
];

/**
 * 전체 파이프라인 플로우 — 활성 단계가 계속 순환하며 "처리 흐름"을 보여준다.
 * 한 번 보여주고 멈추지 않고, 단계가 끊임없이 흐른다(살아있는 느낌).
 * prefers-reduced-motion이면 순환 정지(전체 정적 노출).
 */
export function CaptionStory() {
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduce(r);
    if (r) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bento p-6 sm:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-1">
        {STEPS.map((s, i) => {
          const on = !reduce && i === active;
          const done = !reduce && i < active;
          return (
            <Fragment key={s.title}>
              {/* 단계 카드 */}
              <div
                className="flex flex-1 items-center gap-3 rounded-xl border p-4 transition-all duration-500 md:flex-col md:justify-center md:text-center"
                style={{
                  borderColor: on
                    ? 'color-mix(in oklab, var(--color-accent) 60%, transparent)'
                    : 'color-mix(in oklab, var(--color-border) 60%, transparent)',
                  background: on
                    ? 'color-mix(in oklab, var(--color-accent) 10%, var(--color-card))'
                    : 'color-mix(in oklab, var(--color-card) 55%, transparent)',
                  transform: on ? 'scale(1.04)' : 'scale(1)',
                  boxShadow: on ? 'var(--shadow-accent-glow)' : 'none',
                  opacity: reduce ? 1 : on || done ? 1 : 0.55,
                }}
              >
                {/* 아이콘 (활성 시 살짝 튐) */}
                <span
                  className="text-3xl transition-transform duration-500 sm:text-4xl"
                  style={{ transform: on ? 'translateY(-2px) scale(1.1)' : 'none' }}
                >
                  {s.icon}
                </span>

                <div className="md:mt-2">
                  <div className="flex items-center gap-1.5 md:justify-center">
                    <span
                      className="font-mono text-[10px] text-muted-foreground/60"
                      aria-hidden
                    >
                      0{i + 1}
                    </span>
                    <span className="text-sm font-bold tracking-tight sm:text-base">
                      {s.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>

                  {/* 음성 인식 단계 — 미니 파형(계속 들썩) */}
                  {s.wave && (
                    <div className="mt-2 flex h-5 items-end justify-center gap-0.5 md:h-6">
                      {Array.from({ length: 7 }).map((_, b) => (
                        <span
                          key={b}
                          className="pwave w-0.5 rounded-full bg-gradient-to-t from-[var(--aurora-purple)] to-[var(--aurora-cyan)]"
                          style={
                            {
                              height: `${40 + ((b * 23) % 60)}%`,
                              opacity: on ? 0.95 : 0.55,
                              '--eq-dur': `${0.7 + (b % 4) * 0.16}s`,
                              '--eq-delay': `${b * 0.06}s`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 커넥터 (마지막 제외) — 모바일은 ↓, 데스크톱은 → */}
              {i < STEPS.length - 1 && (
                <div className="flex shrink-0 items-center justify-center md:w-6">
                  <span
                    className="rotate-90 text-lg transition-colors duration-500 md:rotate-0"
                    style={{
                      color: done
                        ? 'var(--color-accent)'
                        : 'color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)',
                    }}
                  >
                    →
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
