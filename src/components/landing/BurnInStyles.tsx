'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 번인 자막 스타일 — 라이브 미니 프리뷰.
 * 기본은 완성된 자막을 그 스타일로 보여주고, 호버하면 실제 한국어 한 줄이
 * 그 스타일로 다시 타이핑된다(히어로 캡션 프레임과 동일한 결).
 */

const SAMPLE = '이제 영상만 올리면 끝';

const STYLES = [
  { label: '깔끔', cls: 'bg-white text-black', sub: '흰 자막' },
  { label: '볼드 옐로', cls: 'bg-black text-[#ffd34d]', sub: '쇼츠·릴스' },
  { label: '박스', cls: 'bg-accent text-accent-foreground', sub: '강조 박스' },
  { label: '예능', cls: 'bg-black text-white ring-2 ring-[#ffd34d]', sub: '외곽선' },
];

export function BurnInStyles() {
  return (
    <div className="scroll-fade grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STYLES.map((st) => (
        <BurnInCard key={st.label} st={st} />
      ))}
    </div>
  );
}

function BurnInCard({ st }: { st: (typeof STYLES)[number] }) {
  const [txt, setTxt] = useState(SAMPLE);
  const [typing, setTyping] = useState(false);
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (idRef.current) {
      clearInterval(idRef.current);
      idRef.current = null;
    }
  };

  const onEnter = () => {
    stop();
    setTyping(true);
    let i = 0;
    setTxt('');
    idRef.current = setInterval(() => {
      i += 1;
      setTxt(SAMPLE.slice(0, i));
      if (i >= SAMPLE.length) {
        stop();
        setTyping(false);
      }
    }, 55);
  };

  const onLeave = () => {
    stop();
    setTyping(false);
    setTxt(SAMPLE);
  };

  useEffect(() => stop, []);

  return (
    <div
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="relative mb-3 grid aspect-video place-items-center overflow-hidden rounded-lg bg-[#0c0c11]">
        <div className="absolute inset-0 opacity-40 aurora-subtle" aria-hidden />
        <span className="absolute left-2 top-2 rounded bg-accent px-1 py-0.5 text-[8px] font-bold text-accent-foreground">CC</span>
        <span className={`relative inline-flex items-center rounded px-2 py-1 text-xs font-extrabold ${st.cls}`}>
          {txt || ' '}
          {typing && <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse-glow bg-current align-middle" />}
        </span>
      </div>
      <p className="text-sm font-bold tracking-tight">{st.label}</p>
      <p className="text-xs text-muted-foreground">{st.sub}</p>
    </div>
  );
}
