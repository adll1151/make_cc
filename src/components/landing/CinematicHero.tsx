'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Magnet } from '@/components/reactbits/Magnet';
import { StarBorder } from '@/components/reactbits/StarBorder';
import { Squares } from '@/components/reactbits/Squares';

/**
 * 시네마틱 HUD 히어로 — Stark/JARVIS 풍 "음성 HUD".
 *
 * 성능: 연속 모션을 React state에서 분리한다. 스크롤 진행도 p는
 * rAF 루프에서 이징(easing)으로 부드럽게 따라가며, CSS 변수 `--p`로
 * 무대(stage)에 직접 주입한다. 장식 레이어들은 calc(var(--p) ...)로
 * 변형되므로 스크롤마다 재렌더가 일어나지 않는다(버벅임 제거).
 * 게이지/타임코드도 DOM ref로 직접 갱신한다.
 * React 재렌더는 "씬 전환(active)" 4회뿐.
 *
 * 이 방식은 JS 구동이라 reduced-motion에서도 스크롤 시 부드럽게 움직인다.
 * CSS 키프레임 루프(파형 들썩·글로우 호흡)만 모션 설정을 존중해 멈춘다.
 */

type Scene = {
  id: string;
  tag: string;
  stage: string;
  head1: string;
  accent: string;
  head2?: string;
  sub: string;
  metricLabel: string;
  metricValue: string;
  caption: string;
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
    caption: '안녕하세요, make_cc입니다',
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
    caption: '영상의 한국어 음성을 자동으로',
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
    caption: '한 줄씩 다듬어 완벽하게',
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
    caption: 'SRT 다운로드 · 공유까지 한 번에',
  },
];

const N = SCENES.length;

// 씬별 강조 색조(OKLCH hue) — 듣기=앰버, 인식=시안, 편집=바이올렛, 완성=그린.
// rAF에서 보간되어 화면 전체(글로우·리액터·헤드라인)가 씬마다 다른 색으로 전환.
const HUES = [62, 205, 288, 152];

const rand = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const DOTS = Array.from({ length: 56 }, (_, i) => ({
  x: rand(i, 1) * 100,
  y: rand(i, 2) * 100,
  s: 0.5 + rand(i, 3) * 2.2,
  o: 0.12 + rand(i, 4) * 0.5,
  tw: 2 + rand(i, 5) * 4,
  dl: rand(i, 6) * 4,
  px: 0.4 + rand(i, 7) * 2.2, // 시차 깊이(강화)
}));

const CBARS = Array.from({ length: 30 }, (_, i) => ({
  base: 22 + rand(i, 11) * 66,
  dur: 0.7 + rand(i, 12) * 0.7,
  delay: rand(i, 13) * 1.2,
}));

const FRAGMENTS = [
  { pos: 'left-[4%] top-[24%] sm:left-[7%]', px: 2.2, tag: 'ENGINE', title: 'Whisper large-v3', meta: 'self-hosted GPU · ko-KR', hideMobile: false },
  { pos: 'right-[4%] top-[30%] sm:right-[8%]', px: 1.4, tag: 'SPEED', title: '5분 영상 ≈ 3분 처리', meta: '평균 처리 시간', hideMobile: true },
  { pos: 'left-[6%] bottom-[20%] sm:left-[11%]', px: 3.0, tag: 'OUTPUT', title: 'SRT · 번인 MP4 · 공유', meta: '표준 자막 그대로 사용', hideMobile: true },
  { pos: 'right-[5%] bottom-[24%] sm:right-[10%]', px: 2.6, tag: 'PRIVACY', title: '처리 후 자동 삭제', meta: '게스트 1시간 · 회원 30일', hideMobile: false },
] as const;

const fmtTC = (p: number) => {
  const total = Math.floor(p * 89);
  return `0:${String(total % 60).padStart(2, '0')}`;
};

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engNumRef = useRef<HTMLSpanElement>(null);
  const engBarRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // rAF 이징 루프 — 스크롤 타깃을 부드럽게 추종. React 재렌더 없이 --p/게이지 갱신.
  useEffect(() => {
    let raf = 0;
    let running = true;
    const cur = { p: 0 };
    let target = 0;

    const measure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
      target = total > 0 ? scrolled / total : 0;
    };

    const tick = () => {
      if (!running) return;
      cur.p += (target - cur.p) * 0.1; // 이징
      if (Math.abs(target - cur.p) < 0.0002) cur.p = target;
      const p = cur.p;
      const st = stageRef.current;
      if (st) {
        st.style.setProperty('--p', p.toFixed(4));
        const fp = Math.min(p, 0.999) * N;
        // 씬별 강조 색조(hue) 보간 → 화면 전체가 씬마다 다른 색으로
        const seg = Math.min(N - 1, Math.floor(fp));
        const frac = Math.min(1, Math.max(0, fp - seg));
        const h = HUES[seg]! + (HUES[Math.min(N - 1, seg + 1)]! - HUES[seg]!) * frac;
        st.style.setProperty('--sa-h', h.toFixed(1));
      }
      const eng = Math.round(p * 99 + 1);
      if (engNumRef.current) engNumRef.current.textContent = String(eng).padStart(2, '0');
      if (engBarRef.current) engBarRef.current.style.width = `${eng}%`;
      if (tcRef.current) tcRef.current.textContent = fmtTC(p);
      const a = Math.min(N - 1, Math.floor(Math.min(p, 0.999) * N));
      // 스크롤 = 타이핑: 씬 내부 진행도만큼 자막을 한 글자씩 친다(중앙 캡션 프레임)
      if (capRef.current) {
        const local = Math.min(1, Math.max(0, Math.min(p, 0.999) * N - a));
        const cap = SCENES[a]!.caption;
        const shown = cap.slice(0, Math.min(cap.length, Math.ceil(local * 1.8 * cap.length)));
        if (capRef.current.textContent !== shown) capRef.current.textContent = shown;
      }
      setActive((prev) => (prev === a ? prev : a));
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => measure();
    measure();
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scene = SCENES[active]!;

  return (
    <section ref={sectionRef} aria-label="make_cc 시네마틱 소개" className="relative" style={{ height: `${N * 100}vh` }}>
      <div
        ref={stageRef}
        className="sticky top-0 flex h-screen min-h-[640px] items-center justify-center overflow-hidden bg-[#05050a] text-white"
        style={
          {
            ['--p']: 0,
            ['--sa-h']: 62,
            ['--sa']: 'oklch(0.78 0.15 var(--sa-h))',
          } as CSSProperties
        }
      >
        {/* ===================== 배경 밀도 레이어 ===================== */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute -inset-[20%]"
            style={{
              background: 'radial-gradient(38% 38% at 50% 38%, color-mix(in oklab, var(--sa) 28%, transparent), transparent 70%)',
              transform: 'translateY(calc(var(--p) * -60px))',
              animation: reduce ? undefined : 'scene-drift 16s ease-in-out infinite',
            }}
          />
          <div
            className="absolute -inset-[20%]"
            style={{
              background: 'radial-gradient(34% 34% at 74% 76%, oklch(0.52 0.2 18 / 0.32), transparent 72%)',
              transform: 'translateY(calc(var(--p) * 50px))',
              animation: reduce ? undefined : 'scene-drift 22s ease-in-out infinite reverse',
            }}
          />

          {/* 격자 그리드 — 시차 */}
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              maskImage: 'radial-gradient(82% 72% at 50% 45%, transparent 28%, black 92%)',
              WebkitMaskImage: 'radial-gradient(82% 72% at 50% 45%, transparent 28%, black 92%)',
              transform: 'translateY(calc(var(--p) * 40px))',
            }}
          >
            <Squares direction="diagonal" speed={0.3} squareSize={48} borderColor="rgba(140,140,160,0.10)" hoverFillColor="rgba(224,168,90,0.06)" />
          </div>

          {/* 파티클 별 — 시차 강화 */}
          {DOTS.map((d, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={
                {
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  width: d.s,
                  height: d.s,
                  opacity: d.o,
                  boxShadow: '0 0 4px rgba(255,255,255,0.5)',
                  transform: `translateY(calc(var(--p) * ${(-90 * d.px).toFixed(1)}px))`,
                  animation: reduce ? undefined : `pulse-glow ${d.tw}s ${d.dl}s ease-in-out infinite`,
                } as CSSProperties
              }
            />
          ))}

          {/* 스캔라인 */}
          <div
            className="absolute inset-0 opacity-[0.5] mix-blend-overlay"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)' }}
          />

          <BackgroundWave />

          <div className="absolute inset-0 shadow-[inset_0_0_240px_70px_rgba(0,0,0,0.85)]" />
          <div
            className="absolute left-1/2 top-1/2 size-[42rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(5,5,10,0.7), transparent 75%)' }}
          />
          <div className="grain-overlay !absolute opacity-[0.07]" />
        </div>

        {/* ===================== 플로팅 텔레메트리 카드 ===================== */}
        <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden>
          {FRAGMENTS.map((f, i) => (
            <div key={i} className={`absolute ${f.pos} ${f.hideMobile ? 'hidden lg:block' : ''}`} style={{ transform: `translateY(calc(var(--p) * ${(-90 * f.px).toFixed(0)}px))` }}>
              <div className="glass rounded-xl border border-white/10 px-3.5 py-2.5 font-mono shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-accent/90">
                  <span className="size-1 rounded-full bg-accent" />
                  {f.tag}
                </div>
                <div className="mt-1 max-w-[12rem] text-[13px] font-semibold tracking-tight text-white/90">{f.title}</div>
                <div className="mt-0.5 text-[10px] tracking-wider text-white/45">{f.meta}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===================== HUD 프레임 ===================== */}
        <HudFrame scene={scene} active={active} reduce={reduce} engNumRef={engNumRef} engBarRef={engBarRef} tcRef={tcRef} />

        {/* ===================== 중앙: 캡션 프레임 + 헤드라인 ===================== */}
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center">
          <CaptionStage reduce={reduce} capRef={capRef} />

          <div key={`chip-${active}`} className="enter-fade-up mt-9 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs tracking-wider text-white/70 backdrop-blur-sm">
            <span className="size-1.5 animate-pulse-glow rounded-full" style={{ background: 'var(--sa)' }} />
            STEP {String(active + 1).padStart(2, '0')} / 0{N} · {scene.stage}
          </div>

          <h1 key={`head-${active}`} className="enter-fade-up mt-5 text-balance text-[clamp(2.5rem,8.5vw,6rem)] font-extrabold leading-[0.96] tracking-[-0.04em] [text-shadow:0_2px_40px_rgba(0,0,0,0.5)]">
            {scene.head1}{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to bottom, var(--sa), color-mix(in oklab, var(--sa) 55%, white))' }}>{scene.accent}</span>
            {scene.head2 ? <> {scene.head2}</> : '.'}
          </h1>

          <p key={`sub-${active}`} className="enter-fade-up mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-white/65 sm:text-lg">
            {scene.sub}
          </p>

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
            <Button asChild variant="outline" size="xl" className="min-w-40 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/demo">데모 보기</Link>
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-2" aria-hidden>
            {SCENES.map((s, i) => (
              <span key={s.id} className="h-1 rounded-full transition-all duration-500" style={{ width: i === active ? 28 : 10, background: i === active ? 'var(--sa)' : 'color-mix(in oklab, white 22%, transparent)' }} />
            ))}
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2" style={{ opacity: active >= N - 1 ? 0 : 0.6, transition: 'opacity 0.5s' }} aria-hidden>
          <div className="flex flex-col items-center gap-1.5 font-mono text-[10px] tracking-widest text-white/50">
            스크롤 ↓
            <span className="flex h-7 w-4 items-start justify-center rounded-full border border-white/30 p-1">
              <span className="size-1 animate-float rounded-full bg-white/70" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== 배경 거대 파형 (정적 + 가로 시프트) ===================== */

function BackgroundWave() {
  const pts = Array.from({ length: 120 }, (_, i) => {
    const y = 50 + Math.sin(i * 0.5) * (8 + (i % 9)) * (i % 2 ? 1 : -1) * 0.6;
    return `${(i / 119) * 200 - 50},${y}`;
  }).join(' ');
  return (
    <svg className="absolute inset-x-0 top-1/2 h-40 w-full -translate-y-1/2 opacity-[0.12]" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--sa)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" style={{ transform: 'translateX(calc(var(--p) * -25px))' }} />
    </svg>
  );
}

/* ===================== HUD 프레임 ===================== */

function HudFrame({
  scene,
  active,
  reduce,
  engNumRef,
  engBarRef,
  tcRef,
}: {
  scene: Scene;
  active: number;
  reduce: boolean;
  engNumRef: React.RefObject<HTMLSpanElement>;
  engBarRef: React.RefObject<HTMLDivElement>;
  tcRef: React.RefObject<HTMLSpanElement>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      <Corner className="left-4 top-4 border-l-2 border-t-2 sm:left-7 sm:top-7" />
      <Corner className="right-4 top-4 border-r-2 border-t-2 sm:right-7 sm:top-7" />
      <Corner className="bottom-4 left-4 border-b-2 border-l-2 sm:bottom-7 sm:left-7" />
      <Corner className="bottom-4 right-4 border-b-2 border-r-2 sm:bottom-7 sm:right-7" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25">
        <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white" />
        <div className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-white" />
        <div className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white" />
        <div className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white" />
      </div>

      {!reduce && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent hud-sweep" />}

      <div className="absolute left-4 top-4 font-mono text-[10px] leading-relaxed tracking-wider text-white/55 sm:left-9 sm:top-9 sm:text-[11px]">
        <div className="flex items-center gap-1.5 text-white/80">
          <span className="rounded bg-accent px-1 py-0.5 text-[9px] font-bold text-accent-foreground">CC</span>
          MAKE_CC <span className="text-white/35">/ ENGINE</span>
        </div>
        <div className="mt-1.5 hud-flicker">{scene.tag}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-white/35">
          <span className="inline-flex items-center gap-1 text-[oklch(0.62_0.22_18)]">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-[oklch(0.62_0.22_18)]" /> REC
          </span>
          · <span ref={tcRef}>0:00</span>
        </div>
      </div>

      <div className="absolute right-4 top-4 text-right font-mono text-[10px] tracking-wider text-white/55 sm:right-9 sm:top-9 sm:text-[11px]">
        <div className="text-white/35">CC ENGINE</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-white/85 sm:text-3xl">
          <span ref={engNumRef}>01</span>
          <span className="text-sm" style={{ color: 'var(--sa)' }}>%</span>
        </div>
        <div className="ml-auto mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div ref={engBarRef} className="h-full rounded-full" style={{ width: '1%', background: 'var(--sa)' }} />
        </div>
      </div>

      <div className="absolute bottom-4 left-4 font-mono text-[10px] tracking-wider text-white/45 sm:bottom-9 sm:left-9 sm:text-[11px]">
        <div className="text-white/30">VOL · REL</div>
        <div className="mt-1 flex items-end gap-0.5">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="w-1 rounded-sm" style={{ height: `${6 + ((i * 5 + active * 7) % 18)}px`, background: i < 10 ? 'color-mix(in oklab, var(--sa) 80%, transparent)' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-right font-mono text-[10px] tracking-wider text-white/55 sm:bottom-9 sm:right-9 sm:text-[11px]">
        <div className="text-white/30">{scene.metricLabel}</div>
        <div key={`m-${active}`} className="enter-fade-up mt-1 text-xl font-bold tabular-nums sm:text-2xl" style={{ color: 'var(--sa)' }}>{scene.metricValue}</div>
      </div>

      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 font-mono text-[10px] tracking-wider lg:flex">
        {SCENES.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className={i === active ? '' : 'text-white/35'} style={i === active ? { color: 'var(--sa)' } : undefined}>{s.stage}</span>
            <span className="h-px transition-all duration-300" style={{ width: i === active ? 28 : 14, background: i === active ? 'var(--sa)' : 'rgba(255,255,255,0.2)' }} />
            <span className="size-1.5 rounded-full transition-all" style={{ background: i <= active ? 'var(--sa)' : 'rgba(255,255,255,0.2)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute size-6 border-white/25 sm:size-8 ${className}`} />;
}

/* ===================== 캡션 프레임 (음성 → 자막 타이핑) ===================== */

/**
 * 중앙 주인공 = 비디오 캡션 프레임. 스크롤하면 씬 자막이 한 글자씩 타이핑되고
 * (capRef는 rAF가 갱신), 하단 스크러버가 진행도(--p)를 채운다. make_cc의 본질
 * (음성→자막)을 직관적으로 보여준다. 색은 씬별 --sa로 recolor.
 */
function CaptionStage({ reduce, capRef }: { reduce: boolean; capRef: React.RefObject<HTMLSpanElement> }) {
  return (
    <div className="relative w-[min(90vw,540px)]" style={{ transform: 'scale(calc(1 + var(--p) * 0.05))' }}>
      <div
        className="reactor-breathe absolute -inset-10 rounded-[2.5rem]"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--sa) 26%, transparent), transparent 72%)' }}
        aria-hidden
      />

      {/* 비디오 캡션 프레임 */}
      <div
        className="relative aspect-video overflow-hidden rounded-2xl border bg-[#0a0a12]"
        style={{
          borderColor: 'color-mix(in oklab, var(--sa) 28%, rgba(255,255,255,0.12))',
          boxShadow:
            '0 40px 120px -30px color-mix(in oklab, var(--sa) 45%, transparent), inset 0 0 70px -24px color-mix(in oklab, var(--sa) 55%, transparent)',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(62% 54% at 50% 32%, color-mix(in oklab, var(--sa) 16%, transparent), transparent 72%)' }} aria-hidden />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)' }}
          aria-hidden
        />
        <div className="grain-overlay !absolute opacity-[0.05]" aria-hidden />
        <FrameCorners />

        {/* 상단 바 */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between font-mono text-[10px] sm:text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--sa)', color: '#05050a' }}>CC</span>
            <span className="text-white/55">AI 자막 생성</span>
          </span>
          <span className="flex items-center gap-1 text-[oklch(0.65_0.2_18)]">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-[oklch(0.65_0.2_18)]" /> REC
          </span>
        </div>

        {/* 중앙 파형 — 듣는 중(자막 바 뒤) */}
        <div className="absolute inset-x-0 top-[30%] flex h-12 items-center justify-center gap-[3px] px-10 opacity-60 sm:h-16" aria-hidden>
          {CBARS.map((b, i) => (
            <span
              key={i}
              className={reduce ? '' : 'cwave'}
              style={
                {
                  width: 3,
                  height: `${b.base}%`,
                  borderRadius: 999,
                  background: 'linear-gradient(to top, var(--sa), color-mix(in oklab, var(--sa) 40%, white))',
                  '--eq-dur': `${b.dur}s`,
                  '--eq-delay': `${b.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* 자막 바 — 스크롤로 타이핑(주인공) */}
        <div className="absolute inset-x-0 bottom-9 flex justify-center px-5 sm:bottom-11">
          <div className="max-w-[92%] rounded-md bg-black/65 px-3 py-1.5 text-center backdrop-blur-sm">
            <span ref={capRef} className="align-middle text-base font-bold leading-snug text-white sm:text-2xl" />
            <span
              className="ml-0.5 inline-block h-[0.95em] w-[3px] translate-y-[0.12em] animate-pulse-glow align-middle"
              style={{ background: 'var(--sa)' }}
              aria-hidden
            />
          </div>
        </div>

        {/* 하단 스크러버 = 진행도(--p) */}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2" aria-hidden>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="white" className="shrink-0 opacity-70">
            <path d="M8 5v14l11-7z" />
          </svg>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full" style={{ width: 'calc(var(--p) * 100%)', background: 'var(--sa)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameCorners() {
  const base = 'pointer-events-none absolute size-4 border-white/25';
  return (
    <span aria-hidden>
      <span className={`${base} left-2 top-2 border-l border-t`} />
      <span className={`${base} right-2 top-2 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </span>
  );
}

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} width="18" height="18">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
