'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 다국어 번역 쇼케이스 — "한국어 자막(원본)을 만들면 영어·일본어·중국어로 자동 번역"을
 * 한눈에 보여준다. 원본 한국어를 고정 노출하고, 그 아래 번역본이 언어별로 순환.
 */
const KO = '이제 영상만 올리면 끝';
const LANGS = [
  { code: 'en', flag: '🇺🇸', label: 'English', text: "Just upload your video — that's it." },
  { code: 'ja', flag: '🇯🇵', label: '日本語', text: 'あとは動画をアップするだけ' },
  { code: 'zh', flag: '🇨🇳', label: '中文', text: '只需上传视频，就这么简单' },
] as const;
const CYCLE_MS = 2600;

export function MultiLangCaptions() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  useEffect(() => {
    if (paused || reduced.current) return;
    const id = setInterval(() => setActive((a) => (a + 1) % LANGS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const cur = LANGS[active]!;

  return (
    <div
      className="scroll-pop relative mx-auto flex aspect-video w-full max-w-3xl select-none flex-col overflow-hidden rounded-2xl border border-border bg-[#0a0a12] shadow-[var(--shadow-card)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 배경 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(44% 56% at 32% 24%, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 66%), radial-gradient(54% 60% at 80% 82%, oklch(0.5 0.13 280 / 0.28), transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />

      {/* 헤더: 무슨 기능인지 명시 */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2 py-1 text-[11px] font-bold text-accent ring-1 ring-accent/30">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" /> 자동 번역
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/60 backdrop-blur-sm">
          1개 자막 → {LANGS.length + 1}개 언어
        </span>
      </div>

      {/* 본문: 원본(한국어) → 번역본 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6">
        {/* 원본 */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-widest text-white/40">🇰🇷 원본 · 한국어</span>
          <span className="rounded-md bg-white/[0.07] px-3.5 py-1.5 text-base font-semibold text-white/90 sm:text-lg">
            {KO}
          </span>
        </div>

        {/* 화살표 (자동 번역) */}
        <div className="flex flex-col items-center text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>

        {/* 번역본 (언어별 순환) */}
        <div className="flex flex-col items-center gap-1.5">
          <span key={`l-${cur.code}`} className="animate-[fade-up_0.4s_ease] font-mono text-[10px] tracking-widest text-accent/80">
            {cur.flag} 번역 · {cur.label}
          </span>
          <span
            key={`t-${cur.code}`}
            lang={cur.code}
            className="animate-[fade-up_0.45s_ease] rounded-md bg-accent/15 px-4 py-2 text-center text-lg font-bold text-white shadow-[0_2px_12px_rgba(0,0,0,0.4)] ring-1 ring-accent/25 sm:text-2xl"
          >
            {cur.text}
          </span>
        </div>
      </div>

      {/* 언어 선택 칩 */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 px-4 pb-4">
        {LANGS.map((l, i) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition',
              i === active
                ? 'border-accent bg-accent/20 text-white'
                : 'border-white/15 bg-white/5 text-white/55 hover:text-white/80',
            )}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
