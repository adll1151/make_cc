'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** 예시 영상(`/samples/demo.mp4`) 위에 얹는 illustrative 자막 3줄. 실제 재생 시간에 3등분해 노출. */
const CUES = [
  { text: '안녕하세요, make_cc입니다' },
  { text: '영상의 한국어 음성을' },
  { text: '자동으로 자막으로 만들어드려요' },
];
const DEMO_SRC = '/samples/demo.mp4';

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * 제품 쇼케이스 — 실제 예시 영상(`/samples/demo.mp4`)이 재생되고 그 위에 자동 자막이 얹힌다.
 * 자막·진행바·리스트 강조는 영상의 실제 재생 시간에 동기화된다(재생/정지 동작).
 * 영상 로드 실패 시엔 합성 타임라인으로 무해하게 폴백(검은 화면이 멈춰 보이지 않게).
 */
export function EditorShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(9);
  const [playing, setPlaying] = useState(true);
  const [reduce, setReduce] = useState(false);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduce(r);
    // reduce-motion: autoPlay 억제와 컨트롤 상태를 일치시킴(정지 아이콘·스크러버 멈춤 방지)
    if (r) {
      setPlaying(false);
      videoRef.current?.pause();
    }
  }, []);

  // 영상 실패 시에만 도는 합성 폴백(영상이 정상이면 timeupdate가 time을 몰아감)
  useEffect(() => {
    if (videoOk || !playing) return;
    const id = setInterval(() => setTime((t) => (t + 0.08) % 9), 80);
    return () => clearInterval(id);
  }, [videoOk, playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (v && videoOk) {
      if (v.paused) void v.play();
      else v.pause();
    } else {
      setPlaying((p) => !p);
    }
  };

  const dur = videoOk ? duration : 9;
  const progress = dur > 0 ? (time / dur) * 100 : 0;
  const activeIdx = Math.min(CUES.length - 1, Math.max(0, Math.floor((time / dur) * CUES.length)));
  const active = CUES[activeIdx]!;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* 브라우저 크롬 */}
      <div className="flex items-center gap-2 border-b border-border bg-subtle px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex-1 truncate rounded-md border border-border bg-background px-3 py-1 text-center font-mono text-xs text-muted-foreground">
          make_cc / 편집기
        </span>
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <span className="truncate text-sm font-semibold">my-video.mp4</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">✓ 저장됨</span>
          <span className="rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background">SRT 다운로드</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_280px]">
        {/* 예시 영상 씬 */}
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#0c0c11]">
          {/* 실제 예시 영상 — public/samples/demo.mp4 교체 시 랜딩·/editor/sample에 자동 반영 */}
          <video
            ref={videoRef}
            src={DEMO_SRC}
            muted
            loop
            playsInline
            autoPlay={!reduce}
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 9);
              setVideoOk(true);
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setVideoOk(false)}
          />
          {/* 영상 로드 실패 시 폴백(검은 화면 방지) */}
          {!videoOk && !reduce && (
            <>
              <div
                className="absolute -inset-[25%]"
                style={{
                  background:
                    'radial-gradient(38% 38% at 32% 30%, color-mix(in oklab, var(--color-accent) 34%, transparent), transparent 70%)',
                  animation: 'scene-drift 14s ease-in-out infinite',
                }}
              />
              <div
                className="absolute -inset-[25%]"
                style={{
                  background: 'radial-gradient(42% 42% at 72% 68%, oklch(0.55 0.07 270 / 0.4), transparent 70%)',
                  animation: 'scene-drift 18s ease-in-out infinite reverse',
                }}
              />
            </>
          )}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_30px_rgba(0,0,0,0.6)]" />
          <div className="grain-overlay !absolute opacity-[0.07]" aria-hidden />

          <span className="absolute left-3 top-3 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
            CC
          </span>

          {/* 자막 (재생 시간 따라) */}
          <span
            key={activeIdx}
            className="enter-fade-up absolute inset-x-0 bottom-9 z-10 mx-auto w-fit max-w-[92%] rounded bg-black/70 px-3 py-1.5 text-center text-sm font-semibold text-white backdrop-blur-sm sm:text-base"
          >
            {active.text}
          </span>

          {/* 컨트롤 바 */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-7">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? '일시정지' : '재생'}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              {playing ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
            <span className="shrink-0 font-mono text-[11px] text-white/70">
              {fmt(time)} / {fmt(dur)}
            </span>
          </div>
        </div>

        {/* 자막 리스트 — 재생 위치 강조 */}
        <div className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">자막</p>
          {CUES.map((c, i) => {
            const on = i === activeIdx;
            return (
              <div
                key={i}
                className="rounded-lg border p-2.5 transition-all duration-300"
                style={
                  {
                    borderColor: on
                      ? 'color-mix(in oklab, var(--color-accent) 50%, transparent)'
                      : 'var(--color-border)',
                    background: on
                      ? 'color-mix(in oklab, var(--color-accent) 10%, var(--color-card))'
                      : 'color-mix(in oklab, var(--color-subtle) 60%, transparent)',
                  } as CSSProperties
                }
              >
                <p className="font-mono text-[10px] text-muted-foreground">
                  {fmt((dur / CUES.length) * i)}
                </p>
                <p className={`mt-0.5 text-sm ${on ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {c.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
