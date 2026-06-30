'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Before / After 슬라이더 — 손잡이를 끌면 왼쪽=자막 없는 원본, 오른쪽=자막 박힌 영상.
 * 제품 가치를 한 컷에 증명.
 *
 * 드래그는 컨테이너의 **포인터 이벤트 + `touch-action: none`** 으로 직접 처리한다.
 * (네이티브 `<input type=range>`는 터치에서 드래그가 스크롤 제스처에 가로채여 손잡이가
 *  안 움직이는 문제가 있어 제거. 키보드/a11y는 role="slider" + 화살표 키로 대체.)
 */
export function BeforeAfterSlider() {
  const [pos, setPos] = useState(52); // 0..100, 노출 경계(%)
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 캡처 미지원/비활성 포인터면 무시 — dragging 플래그로 계속 추적
      }
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging.current) updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture가 이미 해제된 경우 무시
    }
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPos((p) => Math.max(0, p - 2));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPos((p) => Math.min(100, p + 2));
    }
  }, []);

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="자막 전후 비교 슬라이더"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="scroll-pop relative mx-auto aspect-video w-full max-w-3xl cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl border border-border bg-[#0a0a12] shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {/* ===== AFTER (자막 박힌 영상) — 베이스 ===== */}
      <Footage>
        <span className="absolute left-3 top-3 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">CC</span>
        <span className="absolute right-3 top-3 z-10 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/70 backdrop-blur-sm">
          AFTER · 자막
        </span>
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

      {/* ===== 결과 캡션 — 손잡이 위로 올려 어디서 끌어도 읽히게 ===== */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[12%] z-[24] flex justify-center px-6">
        <span className="rounded-md bg-black/70 px-3 py-1.5 text-center text-base font-bold text-white shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:text-2xl">
          이제 영상만 올리면 끝
        </span>
      </div>
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
      {/* 스튜디오 장면(헤드폰 크리에이터 + 마이크) — "영상"을 명확히 */}
      <StudioScene muted={muted} />
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

/** 녹화 스튜디오 장면 일러스트(SVG) — 헤드폰 쓴 크리에이터가 마이크 앞에서 말하는 모습. */
function StudioScene({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      style={{ filter: muted ? 'grayscale(0.7) brightness(0.82)' : 'none' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="ba-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c3c48" />
          <stop offset="1" stopColor="#15151c" />
        </linearGradient>
        <radialGradient id="ba-back" cx="50%" cy="42%" r="52%">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 백라이트 + 보케 */}
      <ellipse cx="160" cy="84" rx="66" ry="60" fill="url(#ba-back)" />
      <circle cx="42" cy="34" r="11" fill="#ffffff" opacity="0.06" />
      <circle cx="286" cy="46" r="15" fill="var(--color-accent)" opacity="0.1" />

      {/* 어깨 */}
      <path d="M94 180 C94 141 121 125 160 125 C199 125 226 141 226 180 Z" fill="url(#ba-body)" />
      {/* 목 */}
      <rect x="150" y="108" width="20" height="24" rx="8" fill="#2a2a33" />
      {/* 머리 */}
      <circle cx="160" cy="92" r="27" fill="url(#ba-body)" />
      {/* 머리카락 */}
      <path d="M133 90 C133 71 147 61 160 61 C173 61 187 71 187 90 C187 77 174 71 160 71 C146 71 133 77 133 90 Z" fill="#20202a" />
      {/* 헤드폰 밴드 */}
      <path d="M131 95 C131 67 149 55 160 55 C171 55 189 67 189 95" fill="none" stroke="#4c4c5a" strokeWidth="5.5" strokeLinecap="round" />
      {/* 이어컵 */}
      <rect x="124" y="88" width="12" height="20" rx="6" fill="#56566a" />
      <rect x="184" y="88" width="12" height="20" rx="6" fill="#56566a" />
      {/* 액센트 림라이트 */}
      <path d="M135 76 C128 90 128 110 135 124" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
      <path d="M99 176 C99 150 111 134 132 127" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* 마이크(전경) */}
      <g transform="rotate(-16 72 150)">
        <rect x="62" y="118" width="20" height="46" rx="10" fill="#2c2c38" stroke="#545464" strokeOpacity="0.4" strokeWidth="1.5" />
        <line x1="66" y1="126" x2="78" y2="126" stroke="#6c6c7c" strokeWidth="1.3" />
        <line x1="66" y1="132" x2="78" y2="132" stroke="#6c6c7c" strokeWidth="1.3" />
        <line x1="66" y1="138" x2="78" y2="138" stroke="#6c6c7c" strokeWidth="1.3" />
        <rect x="70" y="164" width="4" height="18" fill="#3a3a46" />
      </g>
    </svg>
  );
}
