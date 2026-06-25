'use client';

import { useState } from 'react';

/**
 * Before / After 슬라이더 — 손잡이를 끌면 왼쪽=자막 없는 원본, 오른쪽=자막 박힌 영상.
 * 제품 가치를 한 컷에 증명. 접근성/터치/키보드를 위해 range input을 투명 오버레이로 사용.
 */
export function BeforeAfterSlider() {
  const [pos, setPos] = useState(52); // 0..100, 노출 경계(%)

  return (
    <div className="scroll-pop relative mx-auto aspect-video w-full max-w-3xl select-none overflow-hidden rounded-2xl border border-border bg-[#0a0a12] shadow-[var(--shadow-card)]">
      {/* ===== AFTER (자막 박힌 영상) — 베이스 ===== */}
      <Footage>
        <span className="absolute left-3 top-3 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">CC</span>
        <span className="absolute right-3 top-3 z-10 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/70 backdrop-blur-sm">
          AFTER · 자막
        </span>
        <div className="absolute inset-x-0 bottom-[12%] flex justify-center px-6">
          <span className="rounded-md bg-black/65 px-3 py-1.5 text-center text-base font-bold text-white backdrop-blur-sm sm:text-2xl">
            이제 영상만 올리면 끝
          </span>
        </div>
      </Footage>

      {/* ===== BEFORE (원본, 자막 없음) — 왼쪽만 노출 ===== */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden>
        <Footage muted>
          <span className="absolute right-3 top-3 z-10 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/55 backdrop-blur-sm">
            BEFORE · 원본
          </span>
          <span className="absolute inset-x-0 bottom-[14%] text-center font-mono text-[11px] tracking-widest text-white/35">
            자막 없음
          </span>
        </Footage>
      </div>

      {/* ===== 손잡이 ===== */}
      <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${pos}%` }} aria-hidden>
        <div className="absolute inset-y-0 -translate-x-1/2" style={{ width: 2, background: 'var(--color-accent)', boxShadow: '0 0 12px color-mix(in oklab, var(--color-accent) 80%, transparent)' }} />
        <div className="absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent text-accent-foreground shadow-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>

      {/* ===== range 오버레이 (드래그/터치/키보드/a11y) ===== */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="자막 전후 비교 슬라이더"
        className="absolute inset-0 z-30 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

/** 영상스러운 배경(그레이드된 footage 느낌). */
function Footage({ children, muted = false }: { children?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: muted
            ? 'radial-gradient(50% 60% at 40% 30%, oklch(0.4 0.03 250 / 0.5), transparent 70%), radial-gradient(50% 60% at 75% 80%, oklch(0.35 0.04 280 / 0.4), transparent 70%)'
            : 'radial-gradient(48% 60% at 38% 26%, color-mix(in oklab, var(--color-accent) 26%, transparent), transparent 68%), radial-gradient(52% 60% at 78% 82%, oklch(0.5 0.14 30 / 0.32), transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)' }}
      />
      <div className="grain-overlay !absolute opacity-[0.06]" />
      {children}
    </div>
  );
}
