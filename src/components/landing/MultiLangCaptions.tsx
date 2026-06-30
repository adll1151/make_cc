'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 다국어 번역 쇼케이스 — 클릭/대기 없이 한눈에 이해되도록 원본(한국어) + 번역 3개를
 * 동시에 노출한다. 활성 줄만 은은하게 순환 강조해 생동감만 부여(이해엔 불필요).
 */
const ORIG = { flag: '🇰🇷', label: '한국어', text: '이제 영상만 올리면 끝' };
const TRANS = [
  { code: 'en', flag: '🇺🇸', label: 'English', text: "Just upload your video — that's it." },
  { code: 'ja', flag: '🇯🇵', label: '日本語', text: 'あとは動画をアップするだけ' },
  { code: 'zh', flag: '🇨🇳', label: '中文', text: '只需上传视频，就这么简单' },
] as const;

export function MultiLangCaptions() {
  const [hi, setHi] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced.current) return;
    const id = setInterval(() => setHi((h) => (h + 1) % TRANS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="scroll-pop relative mx-auto flex w-full max-w-3xl select-none flex-col overflow-hidden rounded-2xl border border-border bg-[#0a0a12] pb-3 shadow-[var(--shadow-card)] sm:aspect-video sm:pb-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(44% 56% at 30% 22%, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 66%), radial-gradient(54% 60% at 82% 84%, oklch(0.5 0.13 280 / 0.26), transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />

      {/* 헤더 — 기능 명시 */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 sm:px-5 sm:pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2 py-1 text-[11px] font-bold text-accent ring-1 ring-accent/30">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" /> 자동 번역
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/60 backdrop-blur-sm">
          1개 자막 → 4개 언어
        </span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-2 sm:gap-2.5 sm:px-6">
        {/* 원본 */}
        <Row flag={ORIG.flag} label={ORIG.label} text={ORIG.text} origin />
        <span className="font-mono text-[10px] tracking-widest text-accent/80">↓ 자동 번역</span>
        {/* 번역 3개 — 전부 동시 노출 */}
        {TRANS.map((t, i) => (
          <Row key={t.code} flag={t.flag} label={t.label} text={t.text} lang={t.code} active={!reduced.current && i === hi} />
        ))}
      </div>
    </div>
  );
}

function Row({ flag, label, text, lang, origin = false, active = false }: { flag: string; label: string; text: string; lang?: string; origin?: boolean; active?: boolean }) {
  return (
    <div
      lang={lang}
      className={cn(
        'flex w-full max-w-xl items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-500 sm:gap-3 sm:px-3.5',
        origin
          ? 'bg-white/[0.06]'
          : active
            ? 'bg-accent/15 ring-1 ring-accent/30'
            : 'bg-white/[0.02]',
      )}
    >
      <span className={cn('flex shrink-0 items-center gap-1 font-mono text-[10px] tracking-wider sm:text-[11px]', origin ? 'text-white/45' : active ? 'text-accent' : 'text-white/40')}>
        <span className="text-sm">{flag}</span>
        <span className="hidden w-14 sm:inline">{label}</span>
      </span>
      <span className={cn('flex-1 text-sm font-semibold sm:text-base', origin || active ? 'text-white' : 'text-white/70')}>
        {text}
      </span>
    </div>
  );
}
