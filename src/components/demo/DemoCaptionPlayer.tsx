'use client';

import { useEffect, useState } from 'react';
import { DEMO_CUES } from '@/data/demo-cues';

/**
 * 데모 자막 플레이어 — 영상 위에 자막이 얹혀 재생되는 모습을 보여준다.
 * 실제 영상 대신 씬 배경 + 자막 오버레이가 큐를 순환(자동 재생 느낌).
 * prefers-reduced-motion이면 첫 자막만 표시.
 */
export function DemoCaptionPlayer() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!playing) return;
    const id = setInterval(() => setI((v) => (v + 1) % DEMO_CUES.length), 2600);
    return () => clearInterval(id);
  }, [playing]);

  const cue = DEMO_CUES[i] ?? DEMO_CUES[0];
  const progress = ((i + 1) / DEMO_CUES.length) * 100;
  if (!cue) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-[oklch(0.16_0.02_264)] shadow-[var(--shadow-card)]">
      {/* 씬 배경 */}
      <div className="absolute inset-0 aurora-subtle opacity-70" aria-hidden />
      <div className="grain-overlay !absolute opacity-[0.06]" aria-hidden />

      {/* CC 배지 + 타임코드 */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">
          CC
        </span>
        <span className="font-mono text-xs text-white/60">make_cc 예시 영상</span>
      </div>

      {/* 중앙 음성 파형 표시 */}
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-end justify-center gap-1">
        {Array.from({ length: 36 }).map((_, b) => (
          <span
            key={b}
            className="w-1 rounded-full bg-white/30"
            style={{
              height: `${12 + ((b * 17 + i * 9) % 44)}px`,
              transition: 'height 0.4s ease',
            }}
          />
        ))}
      </div>

      {/* 자막 오버레이 */}
      <div className="absolute inset-x-0 bottom-8 flex justify-center px-6">
        <p
          key={i}
          className="enter-fade-up max-w-[92%] rounded-md bg-black/70 px-3 py-1.5 text-center text-sm font-semibold text-white backdrop-blur-sm sm:text-base"
        >
          {cue.text}
        </p>
      </div>

      {/* 컨트롤 바 */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-6">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? '일시정지' : '재생'}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-white/60">
          {String(i + 1).padStart(2, '0')} / {String(DEMO_CUES.length).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
