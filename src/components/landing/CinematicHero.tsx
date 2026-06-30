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
  en: string; // 번역 자막(한국어 자막이 쳐진 뒤 따라 뜸)
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
    en: 'Hello, this is make_cc',
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
    en: 'Korean speech, transcribed automatically',
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
    en: 'Refined line by line',
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
    en: 'Download SRT & share — in one go',
  },
];

const N = SCENES.length;

// 씬별 강조 색조(OKLCH hue) — 듣기=앰버, 인식=시안, 편집=바이올렛, 완성=그린.
// rAF에서 보간되어 화면 전체(글로우·리액터·헤드라인)가 씬마다 다른 색으로 전환.
const HUES = [62, 205, 288, 152];

// 재생 데모 길이(ms). 재생은 페이지를 함께 auto-scroll해 끝나면 본문으로 자연스럽게 이어짐.
const PLAY_MS = 11000;

const rand = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// 인라인 스타일은 서버/클라가 글자 단위로 동일해야 하이드레이션 미스매치가 안 난다.
// 생성 시 고정 소수점으로 양자화해 두 곳의 직렬화를 일치시킨다.
const q = (n: number, d = 3) => Number(n.toFixed(d));

const DOTS = Array.from({ length: 56 }, (_, i) => ({
  x: q(rand(i, 1) * 100),
  y: q(rand(i, 2) * 100),
  s: q(0.5 + rand(i, 3) * 2.2),
  o: q(0.12 + rand(i, 4) * 0.5),
  tw: q(2 + rand(i, 5) * 4),
  dl: q(rand(i, 6) * 4),
  px: q(0.4 + rand(i, 7) * 2.2), // 시차 깊이(강화)
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
  const transRef = useRef<HTMLSpanElement>(null);
  const playRef = useRef(false); // 재생 중(스크롤과 무관한 자동 데모)
  const playStartRef = useRef(0);
  const lastScrollRef = useRef(0);
  const dispRef = useRef(0); // 현재 표시 진행도(재생 시작 지점 계산용)
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // 재생 토글 — 현재 위치에서 시작해 페이지를 함께 내리며 4씬 데모를 자동 재생.
  const togglePlay = () => {
    if (playRef.current) {
      playRef.current = false;
      setPlaying(false);
    } else {
      const startFrac = dispRef.current > 0.92 ? 0 : dispRef.current; // 끝이면 처음부터 다시
      playStartRef.current = performance.now() - startFrac * PLAY_MS;
      playRef.current = true;
      setPlaying(true);
    }
  };

  // rAF 이징 루프 — 스크롤/재생을 부드럽게 추종. React 재렌더 없이 --p·게이지·자막 갱신.
  // IntersectionObserver로 히어로가 뷰포트 근처일 때만 루프 가동(배터리/CPU 절약).
  useEffect(() => {
    const reduceMM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let inView = true;
    let target = 0; // 스크롤 진행(0..1, raw)
    let disp = 0; // 표시 진행(eased) — 스크롤/재생 공통
    let autoLocal = 0; // 유휴 자동 타이핑
    let prevA = -1;
    let lastFrame = performance.now();

    const measure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
      target = total > 0 ? scrolled / total : 0;
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(64, now - lastFrame);
      lastFrame = now;

      // 진행 소스: 재생 중이면 시간 기반(+페이지 함께 auto-scroll), 아니면 스크롤
      let src: number;
      if (playRef.current) {
        let t = (now - playStartRef.current) / PLAY_MS;
        if (t >= 1) {
          t = 1;
          playRef.current = false;
          setPlaying(false);
        }
        // 재생이 실제 페이지 스크롤을 함께 내림 → 100%면 이미 히어로 끝(본문 바로 위)
        const el = sectionRef.current;
        if (el) {
          const totalScroll = el.offsetHeight - window.innerHeight;
          const absTop = window.scrollY + el.getBoundingClientRect().top;
          window.scrollTo({ top: Math.round(absTop + t * totalScroll), left: 0, behavior: 'instant' as ScrollBehavior });
        }
        src = t;
      } else {
        src = target;
      }
      disp += (src - disp) * 0.12;
      if (Math.abs(src - disp) < 0.0004) disp = src;
      dispRef.current = disp;
      const p = disp;
      const fp = Math.min(p, 0.999) * N;
      const a = Math.min(N - 1, Math.floor(fp));
      const local = Math.min(1, Math.max(0, fp - a));

      // 자막 진행(prog): 재생 중엔 빠르게, 스크롤 중엔 스크롤, 유휴 시 자동 완성
      let prog: number;
      if (playRef.current) {
        prog = Math.min(1, local * 1.6);
      } else {
        const idle = now - lastScrollRef.current > 380;
        if (a !== prevA) autoLocal = local;
        if (!idle) autoLocal = local;
        else if (reduceMM) autoLocal = 1;
        else autoLocal = Math.min(1, autoLocal + dt / 1100);
        prog = Math.max(local, autoLocal);
      }
      prevA = a;

      const st = stageRef.current;
      if (st) {
        st.style.setProperty('--p', p.toFixed(4));
        const seg = Math.min(N - 1, Math.floor(fp));
        const frac = Math.min(1, Math.max(0, fp - seg));
        const h = HUES[seg]! + (HUES[Math.min(N - 1, seg + 1)]! - HUES[seg]!) * frac;
        st.style.setProperty('--sa-h', h.toFixed(1));
      }
      const eng = Math.round(p * 99 + 1);
      if (engNumRef.current) engNumRef.current.textContent = String(eng).padStart(2, '0');
      if (engBarRef.current) engBarRef.current.style.width = `${eng}%`;
      if (tcRef.current) tcRef.current.textContent = fmtTC(p);

      // 자막(KO) → 번역(EN) 순차 타이핑
      const koFrac = Math.min(1, prog / 0.6);
      const enFrac = Math.min(1, Math.max(0, (prog - 0.62) / 0.3));
      if (capRef.current) {
        const ko = SCENES[a]!.caption;
        const s = ko.slice(0, Math.ceil(koFrac * ko.length));
        if (capRef.current.textContent !== s) capRef.current.textContent = s;
      }
      if (transRef.current) {
        const en = SCENES[a]!.en;
        const s = enFrac > 0 ? en.slice(0, Math.ceil(enFrac * en.length)) : '';
        if (transRef.current.textContent !== s) transRef.current.textContent = s;
      }

      setActive((prev) => (prev === a ? prev : a));
      raf = inView ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (!raf && inView) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    // 스크롤 이벤트는 측정만(재생의 auto-scroll도 여기로 들어옴 → 재생을 끊지 않음)
    const onScroll = () => {
      lastScrollRef.current = performance.now();
      measure();
    };

    // 사용자 직접 입력(휠/터치/스크롤 키)은 재생을 취소하고 제어권을 넘김
    const cancelPlay = () => {
      lastScrollRef.current = performance.now();
      if (playRef.current) {
        playRef.current = false;
        setPlaying(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) cancelPlay();
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = !!e?.isIntersecting;
        if (inView) start();
      },
      { rootMargin: '160px' },
    );
    if (sectionRef.current) io.observe(sectionRef.current);

    measure();
    start();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', cancelPlay, { passive: true });
    window.addEventListener('touchstart', cancelPlay, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      inView = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', cancelPlay);
      window.removeEventListener('touchstart', cancelPlay);
      window.removeEventListener('keydown', onKey);
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
                  width: `${d.s}px`,
                  height: `${d.s}px`,
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

        {/* ===================== 플로팅 터미널 로그(타자 치는 느낌) ===================== */}
        <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden>
          {FRAGMENTS.map((f, i) => (
            <div key={i} className={`absolute ${f.pos} ${f.hideMobile ? 'hidden lg:block' : ''}`} style={{ transform: `translateY(calc(var(--p) * ${(-55 * f.px).toFixed(0)}px))` }}>
              <TermFragment tag={f.tag} title={f.title} meta={f.meta} idx={i} />
            </div>
          ))}
        </div>

        {/* ===================== HUD 프레임 ===================== */}
        <HudFrame scene={scene} active={active} reduce={reduce} engNumRef={engNumRef} engBarRef={engBarRef} tcRef={tcRef} />

        {/* ===================== 중앙: 캡션 프레임 + 헤드라인 ===================== */}
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center">
          <CaptionStage reduce={reduce} playing={playing} onToggle={togglePlay} capRef={capRef} transRef={transRef} />

          <div key={`chip-${active}`} className="enter-fade-up mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs tracking-wider text-white/70 backdrop-blur-sm sm:mt-9">
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

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-9 sm:flex-row">
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

          <div className="mt-7 flex items-center gap-2 sm:mt-10" aria-hidden>
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
  // 좌표를 고정 소수점으로 양자화 — Math.sin의 ULP가 런타임(Node/Chromium V8)별로
  // 갈려도 직렬화 문자열이 동일해야 하이드레이션 미스매치가 안 난다.
  const pts = Array.from({ length: 120 }, (_, i) => {
    const x = q((i / 119) * 200 - 50);
    const y = q(50 + Math.sin(i * 0.5) * (8 + (i % 9)) * (i % 2 ? 1 : -1) * 0.6);
    return `${x},${y}`;
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
function CaptionStage({
  reduce,
  playing,
  onToggle,
  capRef,
  transRef,
}: {
  reduce: boolean;
  playing: boolean;
  onToggle: () => void;
  capRef: React.RefObject<HTMLSpanElement>;
  transRef: React.RefObject<HTMLSpanElement>;
}) {
  return (
    <div className="relative w-[min(92vw,560px)]" style={{ transform: 'scale(calc(1 + var(--p) * 0.05))' }}>
      <div
        className="reactor-breathe absolute -inset-10 rounded-[2.5rem]"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--sa) 26%, transparent), transparent 72%)' }}
        aria-hidden
      />

      {/* 비디오 캡션 프레임 */}
      <div
        className={`group relative aspect-video overflow-hidden rounded-2xl border bg-[#08080e] ${playing ? 'cap-play' : ''}`}
        style={{
          borderColor: 'color-mix(in oklab, var(--sa) 28%, rgba(255,255,255,0.12))',
          boxShadow:
            '0 40px 120px -30px color-mix(in oklab, var(--sa) 45%, transparent), inset 0 0 70px -24px color-mix(in oklab, var(--sa) 55%, transparent)',
        }}
      >
        {/* === 영상스러운 배경(그레이드된 footage 느낌) === */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(46% 60% at 38% 24%, color-mix(in oklab, var(--sa) 24%, transparent), transparent 66%), radial-gradient(50% 60% at 78% 82%, oklch(0.5 0.12 calc(var(--sa-h) + 40) / 0.28), transparent 70%)',
            animation: reduce ? undefined : 'scene-drift 14s ease-in-out infinite',
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" aria-hidden />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)' }}
          aria-hidden
        />
        <div className="grain-overlay !absolute opacity-[0.06]" aria-hidden />
        {/* 시네마 레터박스 */}
        <div className="absolute inset-x-0 top-0 h-[7%] bg-black/55" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-[7%] bg-black/55" aria-hidden />
        <FrameCorners />

        {/* 상단 바 */}
        <div className="absolute inset-x-3 top-[10%] flex items-center justify-between font-mono text-[10px] sm:text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--sa)', color: '#05050a' }}>CC</span>
            <span className="text-white/60">AI 자막 생성</span>
          </span>
          <span className="flex items-center gap-1 text-[oklch(0.66_0.2_18)]">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-[oklch(0.66_0.2_18)]" /> REC
          </span>
        </div>

        {/* 중앙 파형 — 듣는 중(자막 뒤). 재생 중엔 .cap-play로 활성화 */}
        <div className="absolute inset-x-0 top-[33%] flex h-12 items-center justify-center gap-[3px] px-10 opacity-55 sm:h-16" aria-hidden>
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

        {/* 재생 버튼 (영상 위) — 강조: 솔리드 액센트 디스크 + 펄스 링 + 라벨 */}
        <div
          className="group/play absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 transition-opacity duration-300"
          style={{ opacity: playing ? 0 : 1, pointerEvents: playing ? 'none' : 'auto' }}
        >
          <div className="relative grid place-items-center">
            {/* 펄스 링 — "눌러보세요" 신호 */}
            {!reduce && (
              <>
                <span className="ring-pulse absolute size-20 rounded-full sm:size-24" style={{ border: '2px solid var(--sa)' }} />
                <span className="ring-pulse absolute size-20 rounded-full sm:size-24" style={{ border: '2px solid var(--sa)', animationDelay: '0.9s' }} />
              </>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-label="자막 생성 데모 재생"
              className="relative grid size-[68px] place-items-center rounded-full transition-transform duration-300 hover:scale-110 sm:size-20"
              style={{
                background: 'radial-gradient(circle at 50% 35%, color-mix(in oklab, var(--sa) 92%, white), var(--sa))',
                color: '#06060c',
                boxShadow: '0 0 60px -4px color-mix(in oklab, var(--sa) 85%, transparent), 0 8px 24px -6px rgba(0,0,0,0.6)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <span
            className="rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide text-white backdrop-blur-md"
            style={{ borderColor: 'color-mix(in oklab, var(--sa) 50%, transparent)', background: 'color-mix(in oklab, var(--sa) 16%, rgba(0,0,0,0.5))' }}
          >
            ▶ 눌러서 자막 생성 보기
          </span>
        </div>
        {/* 재생 중 일시정지(전체 프레임 클릭) */}
        {playing && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="데모 일시정지"
            className="absolute inset-0 z-[9] cursor-pointer"
          />
        )}

        {/* 자막 바(주인공) + 번역 한 줄 */}
        <div className="absolute inset-x-0 bottom-[14%] flex flex-col items-center gap-1.5 px-5">
          <div className="max-w-[92%] rounded-md bg-black/65 px-3 py-1.5 text-center backdrop-blur-sm">
            <span ref={capRef} className="align-middle text-base font-bold leading-snug text-white sm:text-2xl" />
            <span
              className="ml-0.5 inline-block h-[0.95em] w-[3px] translate-y-[0.12em] animate-pulse-glow align-middle"
              style={{ background: 'var(--sa)' }}
              aria-hidden
            />
          </div>
          {/* 번역 자막 — 한국어 뒤로 따라 뜸 */}
          <div className="flex max-w-[92%] items-center gap-1.5 text-center">
            <span className="font-mono text-[9px] tracking-wider" style={{ color: 'var(--sa)' }}>EN</span>
            <span ref={transRef} className="text-[11px] font-medium leading-snug text-white/70 sm:text-sm" />
          </div>
        </div>

        {/* 하단 스크러버 = 진행도(--p) */}
        <div className="absolute inset-x-3 bottom-[8.5%] flex items-center gap-2" aria-hidden>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="white" className="shrink-0 opacity-70">
            {playing ? <rect x="6" y="5" width="4" height="14" rx="1" /> : <path d="M8 5v14l11-7z" />}
            {playing ? <rect x="14" y="5" width="4" height="14" rx="1" /> : null}
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

/**
 * 플로팅 터미널 로그 — 제목이 타자 치듯 입력되고, 잠깐 멈췄다 다시 입력(루프).
 * 기존 "동그라미 + 글래스 카드"의 밋밋함을 라이브 콘솔 느낌으로 대체.
 * setTimeout 기반(JS)이라 reduced-motion에서도 타이핑됨(요청 사항).
 */
function TermFragment({ tag, title, meta, idx }: { tag: string; title: string; meta: string; idx: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const typeOnce = (done: () => void) => {
      let i = 0;
      setN(0);
      const step = () => {
        if (!alive) return;
        i += 1;
        setN(i);
        if (i >= title.length) timer = setTimeout(done, 5200);
        else timer = setTimeout(step, 52);
      };
      timer = setTimeout(step, 60);
    };
    const loop = () => typeOnce(() => alive && loop());
    timer = setTimeout(loop, 350 + idx * 650); // 카드별 스태거
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [title, idx]);

  const typed = title.slice(0, n);
  const done = n >= title.length;

  return (
    <div className="w-[13.5rem] overflow-hidden rounded-lg border border-white/12 bg-black/55 font-mono shadow-[0_10px_34px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md">
      {/* 터미널 헤더 */}
      <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-1 text-[8px] tracking-[0.2em] text-white/40">
        <span style={{ color: 'var(--sa)' }}>›</span>
        {tag}
        <span className="ml-auto h-1 w-1 rounded-full bg-white/25" />
        <span className="h-1 w-1 rounded-full bg-white/25" />
      </div>
      {/* 본문 — 타이핑 */}
      <div className="px-2.5 py-2">
        <div className="text-[12px] font-semibold leading-snug text-white/90">
          <span className="text-white/30">$ </span>
          {typed}
          <span
            className="blink ml-px inline-block h-[1.05em] w-[6px] translate-y-[2px] align-baseline"
            style={{ background: 'var(--sa)', opacity: done ? 0.55 : 1 }}
          />
        </div>
        <div className="mt-1 text-[9.5px] tracking-wider text-white/40">› {meta}</div>
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
