'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 다국어 번역 쇼케이스 — 한국어 자막이 영어·일본어·중국어로 바뀌는 라이브 데모.
 * 주력 기능(DeepL 번역, v0.5.0)을 랜딩에 노출. 자동 순환 + 칩 클릭으로 전환, 호버 시 정지.
 */
const LANGS = [
  { code: 'ko', label: '한국어', text: '이제 영상만 올리면 끝' },
  { code: 'en', label: 'English', text: "Just upload your video — that's it." },
  { code: 'ja', label: '日本語', text: 'あとは動画をアップするだけ' },
  { code: 'zh', label: '中文', text: '只需上传视频，就这么简单' },
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
      className="scroll-pop relative mx-auto aspect-video w-full max-w-3xl select-none overflow-hidden rounded-2xl border border-border bg-[#0a0a12] shadow-[var(--shadow-card)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 영상 느낌 배경 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(46% 58% at 36% 28%, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 66%), radial-gradient(54% 60% at 78% 80%, oklch(0.5 0.13 280 / 0.3), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

      {/* CC 배지 */}
      <span className="absolute left-3 top-3 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
        CC
      </span>
      <span className="absolute right-3 top-3 z-10 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/70 backdrop-blur-sm">
        원본 KO → {cur.label}
      </span>

      {/* 언어 선택 칩 */}
      <div className="absolute inset-x-0 top-11 z-10 flex flex-wrap justify-center gap-1.5 px-4">
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
            {l.label}
          </button>
        ))}
      </div>

      {/* 자막 (언어 전환 시 페이드) */}
      <div className="absolute inset-x-0 bottom-[14%] z-10 flex justify-center px-6">
        <span
          key={cur.code}
          lang={cur.code}
          className="animate-[fade-up_0.5s_ease] rounded-md bg-black/70 px-4 py-2 text-center text-lg font-bold text-white shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:text-2xl"
        >
          {cur.text}
        </span>
      </div>
    </div>
  );
}
