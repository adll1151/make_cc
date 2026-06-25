'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Magnet } from '@/components/reactbits/Magnet';
import { StarBorder } from '@/components/reactbits/StarBorder';

/**
 * 시네마틱 HUD 히어로 — Stark/JARVIS 풍 "음성 HUD".
 *
 * Instagram 릴스(아이언맨 스크롤 시네마틱 포트폴리오)의 연출 기법을
 * make_cc 도메인으로 번역한다:
 *   - 릴스의 캐릭터 → 우리는 "목소리를 듣는" 아크리액터형 라이브 파형
 *   - 릴스의 스크롤 장면 전환(I am Iron Man → Build → Inevitable → 피날레)
 *     → 우리 워크플로 4씬(듣기 → 인식 → 편집 → 완성)을 스크롤로 스크럽
 *   - 화면을 감싸는 HUD 프레임(모서리 브래킷 + 모노스페이스 텔레메트리)
 *
 * 자체 다크 씬(페이지 라이트/다크 테마와 무관하게 시네마처럼 검정 무대).
 * prefers-reduced-motion이면 스크롤잭 없이 첫 씬을 정적으로 보여준다.
 */

type Scene = {
  id: string;
  tag: string; // 좌상단 모노 라벨
  stage: string; // 한글 단계명
  head1: string; // 헤드라인 앞부분
  accent: string; // 앰버 강조 단어
  head2?: string; // 헤드라인 뒷부분(선택)
  sub: string;
  // 우하단 텔레메트리 (라벨/값)
  metricLabel: string;
  metricValue: string;
};

const SCENES: Scene[] = [
  {
    id: 'listen',
    tag: 'AUDIO IN · 48kHz',
    stage: '듣기',
    head1: '영상의 목소리를,',
    accent: '듣습니다',
    sub: '한국어 음성을 실시간으로 포착합니다. 설치도, 로그인도 없이.',
    metricLabel: 'AUDIO LEVEL',
    metricValue: '−6 dB',
  },
  {
    id: 'transcribe',
    tag: 'WHISPER large-v3',
    stage: '인식',
    head1: '말을,',
    accent: '자막으로',
    sub: 'Whisper가 한국어를 인식해 타임코드까지 자동으로 정렬합니다.',
    metricLabel: 'WER',
    metricValue: '< 15%',
  },
  {
    id: 'edit',
    tag: 'EDITOR · LIVE',
    stage: '편집',
    head1: '한 줄씩,',
    accent: '다듬고',
    sub: '브라우저에서 바로 수정하고, 영상 위에서 실시간 미리보기.',
    metricLabel: 'CPS',
    metricValue: '12.4',
  },
  {
    id: 'done',
    tag: 'EXPORT · READY',
    stage: '완성',
    head1: '어디서나 쓰는',
    accent: 'SRT',
    head2: '한 장.',
    sub: '표준 SRT 다운로드 · 번인 영상 · 공유 링크까지 한 번에.',
    metricLabel: 'OUTPUT',
    metricValue: '100%',
  },
];

const N = SCENES.length;
// 중앙 파형 바 — 고정 시드(SSR/CSR 동일, Math.random 미사용)
const BARS = Array.from({ length: 32 }, (_, i) => ({
  dur: 0.7 + ((i * 7) % 9) * 0.06,
  delay: (i % 11) * 0.07,
  base: 24 + ((i * 13) % 64),
}));

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0); // 0..1 전체 스크롤 진행
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const total = el.offsetHeight - window.innerHeight;
        const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
        setProgress(total > 0 ? scrolled / total : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduce]);

  // 진행도 → 활성 씬. 마지막 0.06 구간은 피날레 정착용 버퍼.
  const fp = Math.min(progress, 0.999) * N;
  const active = reduce ? 0 : Math.min(N - 1, Math.floor(fp));
  const scene = SCENES[active]!;
  // 처리율: 히어로 전체에 걸쳐 0 → 100% 상승(텔레메트리 생동감)
  const engine = reduce ? 6 : Math.round(progress * 99 + 1);

  return (
    <section
      ref={sectionRef}
      aria-label="make_cc 시네마틱 소개"
      className="relative"
      style={{ height: reduce ? 'auto' : `${N * 100}vh` }}
    >
      {/* 스티키 무대 — 항상 다크 시네마 */}
      <div className="sticky top-0 flex h-screen min-h-[640px] items-center justify-center overflow-hidden bg-[#07070b] text-white">
        {/* === 배경: 드리프트 글로우 + 그레인 === */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute -inset-[20%] transition-[background] duration-700"
            style={{
              background:
                'radial-gradient(40% 40% at 50% 42%, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)',
              animation: reduce ? undefined : 'scene-drift 16s ease-in-out infinite',
            }}
          />
          <div
            className="absolute -inset-[20%]"
            style={{
              background:
                'radial-gradient(36% 36% at 72% 74%, oklch(0.5 0.18 18 / 0.28), transparent 72%)',
              animation: reduce ? undefined : 'scene-drift 22s ease-in-out infinite reverse',
            }}
          />
          <div className="grain-overlay !absolute opacity-[0.06]" />
          {/* 비네팅 */}
          <div className="absolute inset-0 shadow-[inset_0_0_220px_60px_rgba(0,0,0,0.8)]" />
        </div>

        {/* === HUD 프레임 === */}
        <HudFrame scene={scene} active={active} engine={engine} reduce={reduce} />

        {/* === 중앙: 아크리액터 + 파형(주인공) === */}
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center">
          <Reactor reduce={reduce} accentHot={active >= 1} />

          {/* 단계 칩 */}
          <div
            key={`chip-${active}`}
            className="enter-fade-up mt-9 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs tracking-wider text-white/70 backdrop-blur-sm"
          >
            <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
            STEP {String(active + 1).padStart(2, '0')} / 0{N} · {scene.stage}
          </div>

          {/* 헤드라인 (씬 전환마다 blur-in 재생) */}
          <h1
            key={`head-${active}`}
            className="enter-fade-up mt-5 text-balance text-[clamp(2.5rem,8.5vw,6rem)] font-extrabold leading-[0.96] tracking-[-0.04em]"
          >
            {scene.head1}{' '}
            <span className="bg-gradient-to-b from-accent to-[color-mix(in_oklab,var(--color-accent)_60%,white)] bg-clip-text text-transparent">
              {scene.accent}
            </span>
            {scene.head2 ? <> {scene.head2}</> : '.'}
          </h1>

          <p
            key={`sub-${active}`}
            className="enter-fade-up mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-white/65 sm:text-lg"
          >
            {scene.sub}
          </p>

          {/* CTA — 항상 노출(액션 가능하게 유지) */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Magnet padding={70} magnetStrength={4}>
              <StarBorder>
                <Button asChild size="xl" className="group min-w-48 rounded-full">
                  <Link href="/upload">
                    무료로 시작하기
                    <Arrow className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </StarBorder>
            </Magnet>
            <Button
              asChild
              variant="outline"
              size="xl"
              className="min-w-40 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/demo">데모 보기</Link>
            </Button>
          </div>

          {/* 씬 진행 도트 */}
          <div className="mt-10 flex items-center gap-2" aria-hidden>
            {SCENES.map((s, i) => (
              <span
                key={s.id}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === active ? 28 : 10,
                  background:
                    i === active
                      ? 'var(--color-accent)'
                      : 'color-mix(in oklab, white 22%, transparent)',
                }}
              />
            ))}
          </div>
        </div>

        {/* 스크롤 힌트 (마지막 씬 제외) */}
        {!reduce && (
          <div
            className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-500"
            style={{ opacity: active >= N - 1 ? 0 : 0.6 }}
            aria-hidden
          >
            <div className="flex flex-col items-center gap-1.5 font-mono text-[10px] tracking-widest text-white/50">
              SCROLL
              <span className="flex h-7 w-4 items-start justify-center rounded-full border border-white/30 p-1">
                <span className="size-1 animate-float rounded-full bg-white/70" />
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ===================== HUD 프레임 ===================== */

function HudFrame({
  scene,
  active,
  engine,
  reduce,
}: {
  scene: Scene;
  active: number;
  engine: number;
  reduce: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      {/* 모서리 브래킷 */}
      <Corner className="left-4 top-4 border-l-2 border-t-2 sm:left-7 sm:top-7" />
      <Corner className="right-4 top-4 border-r-2 border-t-2 sm:right-7 sm:top-7" />
      <Corner className="bottom-4 left-4 border-b-2 border-l-2 sm:bottom-7 sm:left-7" />
      <Corner className="bottom-4 right-4 border-b-2 border-r-2 sm:bottom-7 sm:right-7" />

      {/* 스캔 라인 */}
      {!reduce && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent hud-sweep" />
      )}

      {/* 좌상단: 브랜드 + 텔레메트리 */}
      <div className="absolute left-4 top-4 font-mono text-[10px] leading-relaxed tracking-wider text-white/55 sm:left-9 sm:top-9 sm:text-[11px]">
        <div className="flex items-center gap-1.5 text-white/80">
          <span className="rounded bg-accent px-1 py-0.5 text-[9px] font-bold text-accent-foreground">CC</span>
          MAKE_CC <span className="text-white/35">/ ENGINE</span>
        </div>
        <div className="mt-1.5 hud-flicker">{scene.tag}</div>
        <div className="mt-0.5 text-white/35">TELEMETRY · LIVE</div>
      </div>

      {/* 우상단: 엔진 게이지 */}
      <div className="absolute right-4 top-4 text-right font-mono text-[10px] tracking-wider text-white/55 sm:right-9 sm:top-9 sm:text-[11px]">
        <div className="text-white/35">CC ENGINE</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-white/85 sm:text-3xl">
          {String(engine).padStart(2, '0')}
          <span className="text-sm text-accent">%</span>
        </div>
        <div className="mt-1 ml-auto h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${engine}%` }}
          />
        </div>
      </div>

      {/* 좌하단: VU 미터(텍스트) */}
      <div className="absolute bottom-4 left-4 font-mono text-[10px] tracking-wider text-white/45 sm:bottom-9 sm:left-9 sm:text-[11px]">
        <div className="text-white/30">VOL · REL</div>
        <div className="mt-1 flex items-end gap-0.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-sm"
              style={{
                height: `${6 + ((i * 5 + active * 7) % 18)}px`,
                background:
                  i < 9 ? 'color-mix(in oklab, var(--color-accent) 80%, transparent)' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {/* 우하단: 씬 메트릭 */}
      <div className="absolute bottom-4 right-4 text-right font-mono text-[10px] tracking-wider text-white/55 sm:bottom-9 sm:right-9 sm:text-[11px]">
        <div className="text-white/30">{scene.metricLabel}</div>
        <div key={`m-${active}`} className="enter-fade-up mt-1 text-xl font-bold tabular-nums text-accent sm:text-2xl">
          {scene.metricValue}
        </div>
      </div>
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute size-6 border-white/25 sm:size-8 ${className}`} />;
}

/* ===================== 아크리액터 + 파형 ===================== */

function Reactor({ reduce, accentHot }: { reduce: boolean; accentHot: boolean }) {
  return (
    <div className="relative grid size-56 place-items-center sm:size-72">
      {/* 외곽 글로우 */}
      <div
        className="reactor-breathe absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 30%, transparent), transparent 75%)',
        }}
      />
      {/* 회전 점선 링 (텔레메트리) */}
      <div className="reactor-spin absolute inset-2 rounded-full border border-dashed border-white/15" />
      <div className="reactor-spin-rev absolute inset-6 rounded-full border border-white/10" />
      {/* 눈금 링 */}
      <div className="reactor-spin absolute inset-0 rounded-full">
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-0 h-2 w-px origin-[center_7rem] sm:origin-[center_9rem]"
            style={{
              transform: `rotate(${i * 7.5}deg)`,
              background: i % 4 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      {/* 코어 디스크 */}
      <div
        className="relative grid size-32 place-items-center rounded-full border border-white/10 bg-black/40 backdrop-blur-sm sm:size-40"
        style={{
          boxShadow:
            '0 0 60px -8px color-mix(in oklab, var(--color-accent) 55%, transparent), inset 0 0 40px -10px color-mix(in oklab, var(--color-accent) 60%, transparent)',
        }}
      >
        {/* 중앙 라이브 파형 */}
        <div className="flex h-14 items-center gap-[3px] sm:h-16" aria-hidden>
          {BARS.map((b, i) => (
            <span
              key={i}
              className={reduce ? '' : 'cwave'}
              style={
                {
                  width: 3,
                  height: `${b.base}%`,
                  borderRadius: 999,
                  background:
                    'linear-gradient(to top, var(--color-accent), color-mix(in oklab, var(--color-accent) 40%, white))',
                  opacity: accentHot ? 1 : 0.85,
                  '--eq-dur': `${b.dur}s`,
                  '--eq-delay': `${b.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} width="18" height="18">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
