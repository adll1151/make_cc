import { type CSSProperties } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { EditorShowcase } from '@/components/landing/EditorShowcase';
import { CinematicHero } from '@/components/landing/CinematicHero';
import { ReadingProgress } from '@/components/landing/ReadingProgress';
import { BurnInStyles } from '@/components/landing/BurnInStyles';
import { BeforeAfterSlider } from '@/components/landing/BeforeAfterSlider';
import { BlurText } from '@/components/reactbits/BlurText';
import { CountUp } from '@/components/reactbits/CountUp';
import { ScrollVelocity } from '@/components/reactbits/ScrollVelocity';
import { Magnet } from '@/components/reactbits/Magnet';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { StarBorder } from '@/components/reactbits/StarBorder';
import { SpotlightCard } from '@/components/reactbits/SpotlightCard';
import { BackgroundGradientAnimation } from '@/components/reactbits/BackgroundGradientAnimation';

export default function LandingPage() {
  return (
    <main className="relative">
      {/* 상단 읽기 진행 바 (자막 스크러버 톤) */}
      <ReadingProgress />

      {/* 꾸민 배경 — Aceternity Background Gradient Animation (단일 레이어, 절제) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-80" aria-hidden>
        <BackgroundGradientAnimation />
      </div>

      <FloatingNav />

      {/* ============ HERO — 시네마틱 HUD (스크롤 시네마틱) ============ */}
      <CinematicHero />

      {/* 다크 히어로 → 라이트 본문 전환 브리지 */}
      <div aria-hidden className="h-24 bg-gradient-to-b from-[#05050a] to-transparent sm:h-36" />

      {/* ============ 제품 쇼케이스 ============ */}
      <section className="mx-auto -mt-10 max-w-5xl px-6 pb-16">
        <p className="mb-5 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          무료 체험 · 카드 등록 불필요 · 처리 후 자동 삭제
        </p>
        <div className="scroll-pop relative">
          <HudCorners />
          <EditorShowcase />
        </div>
      </section>

      {/* ============ Before / After ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="Before / After" title="자막 하나로, 이렇게." />
        <BeforeAfterSlider />
        <p className="scroll-fade mt-5 text-center text-sm text-muted-foreground">
          손잡이를 끌어 비교해보세요 — 같은 영상, 자막 한 줄의 차이.
        </p>
      </section>

      {/* ============ 어디서나 쓰는 자막 (ScrollVelocity) ============ */}
      <section className="pb-28">
        <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
          만든 SRT 자막, 어디서나 그대로 쓰세요
        </p>
        <ScrollVelocity
          items={PLATFORMS}
          velocity={3}
          itemClassName="text-2xl font-semibold text-muted-foreground/50 sm:text-3xl"
        />
      </section>

      {/* ============ 흐름 (3단계) ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="How it works" title="올리면, 끝." />
        <div className="scroll-fade grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <SpotlightCard
              key={s.n}
              className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
                  {s.icon}
                </span>
                <span className="font-mono text-xs font-bold tracking-widest text-accent">STEP {s.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ 통계 (텔레메트리 패널) ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="scroll-fade">
          <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
            {'// LIVE METRICS'}
          </p>
          <div className="relative">
            <HudCorners />
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
              <Stat value={3} suffix="분" label="5분 영상 평균 처리" />
              <Stat value={15} prefix="< " suffix="%" label="WER (오인식률)" />
              <Stat value={100} suffix="+" label="지원 영상 포맷" />
              <Stat value={0} prefix="₩" label="게스트 무료" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ 사례 ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="Use cases" title="이런 영상에 딱." />
        <div className="scroll-fade grid grid-cols-2 gap-4 lg:grid-cols-4">
          {USECASES.map((u) => (
            <SpotlightCard
              key={u.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
            >
              <CardHud />
              <span className="grid size-11 place-items-center rounded-xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-accent-foreground">
                {u.icon}
              </span>
              <h3 className="mt-4 font-bold tracking-tight">{u.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{u.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ 기능 ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="Features" title="필요한 건 다 있습니다." />
        <div className="scroll-fade grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <SpotlightCard
              key={f.title}
              className={`group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] ${f.span ?? ''} ${f.wide ? 'flex items-center justify-between gap-6' : ''}`}
            >
              <CardHud />
              <div>
                <span className="grid size-11 place-items-center rounded-xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-accent-foreground">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-bold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                {f.featured && (
                  <div className="mt-5 flex h-9 items-end gap-1">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <span
                        key={i}
                        className="pwave w-1 rounded-full bg-gradient-to-t from-[var(--color-accent)] to-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]"
                        style={
                          {
                            height: `${30 + ((i * 17) % 60)}%`,
                            '--eq-dur': `${0.7 + (i % 5) * 0.14}s`,
                            '--eq-delay': `${i * 0.05}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              {f.wide && (
                <span className="hidden shrink-0 items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm font-semibold text-success sm:inline-flex">
                  <IconLock /> 자동 삭제
                </span>
              )}
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ 번인 자막 스타일 (라이브 프리뷰) ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="Burn-in styles" title="자막 스타일, 골라서 박기" />
        <BurnInStyles />
      </section>

      {/* 라이트 본문 → 다크 마무리 전환 브리지 (히어로 진입의 역방향, 수미상관) */}
      <div aria-hidden className="h-20 bg-gradient-to-b from-transparent to-[#05050a] sm:h-28" />

      {/* ============ CTA — 다크 시네마틱 마무리 ============ */}
      <section className="bg-[#05050a] text-white">
        <div className="mx-auto max-w-5xl px-6 pb-20 sm:pb-28">
          <div className="scroll-pop relative overflow-hidden rounded-3xl border border-white/10 bg-[#07070b] px-6 py-16 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.85)] sm:py-20">
            {/* 배경 밀도 — 히어로 결 */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div
                className="animate-breathe absolute left-1/2 top-1/4 size-[32rem] max-w-[88%] -translate-x-1/2 rounded-full"
                style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 70%)' }}
              />
              <div
                className="absolute inset-0 opacity-40 mix-blend-overlay"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)' }}
              />
              <div className="grain-overlay !absolute opacity-[0.06]" />
            </div>
            <HudCorners color="border-white/25" />

            <p className="relative flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-white/50">
              <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
              {'// MAKE_CC ENGINE · READY'}
            </p>

            {/* 미니 라이브 파형 */}
            <div className="relative mx-auto mt-6 flex h-8 w-fit items-center gap-1" aria-hidden>
              {CTA_BARS.map((b, i) => (
                <span
                  key={i}
                  className="pwave w-1 rounded-full bg-gradient-to-t from-[var(--color-accent)] to-[color-mix(in_oklab,var(--color-accent)_40%,white)]"
                  style={{ height: `${b.h}%`, '--eq-dur': `${b.d}s`, '--eq-delay': `${b.dl}s` } as CSSProperties}
                />
              ))}
            </div>

            <h2 className="relative mt-6 text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              지금{' '}
              <span className="bg-gradient-to-b from-accent to-[color-mix(in_oklab,var(--color-accent)_55%,white)] bg-clip-text text-transparent">
                자막
              </span>{' '}
              만들기
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-white/60">
              영상 하나면 됩니다. 5분 안에 결과를 받아보세요.
            </p>

            <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Magnet padding={70} magnetStrength={4}>
                <StarBorder>
                  <Button asChild size="xl" className="group min-w-48 rounded-full">
                    <Link href="/upload">
                      영상 업로드 시작
                      <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
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

            <p className="relative mt-7 font-mono text-[11px] tracking-wider text-white/40">
              무료 · 카드 등록 불필요 · 처리 후 자동 삭제
            </p>
          </div>
        </div>
      </section>

      {/* ============ FOOTER — 다크 마무리 ============ */}
      <footer className="bg-[#05050a] text-white/60">
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#05050a]">cc</span>
              <span className="font-semibold text-white">make_cc</span>
              <span className="text-white/45">· 한국어 음성→자막 자동화</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
              <Link href="/demo" className="transition hover:text-white">데모</Link>
              <Link href="/blog" className="transition hover:text-white">블로그</Link>
              <Link href="/guide" className="transition hover:text-white">가이드</Link>
              <Link href="/faq" className="transition hover:text-white">FAQ</Link>
              <Link href="/privacy" className="transition hover:text-white">개인정보</Link>
              <span className="text-white/35">© 2026 make_cc</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ===================== 데이터 ===================== */

const STEPS = [
  { n: '01', title: '영상 업로드', desc: '브라우저에 끌어다 놓기. 설치·로그인 없이 게스트로도.', icon: <IconUpload /> },
  { n: '02', title: '자동 자막 생성', desc: 'Whisper가 한국어 음성을 인식해 타임코드까지 자동으로.', icon: <IconMic /> },
  { n: '03', title: '편집 · 다운로드', desc: '라인 단위로 다듬고 SRT 다운로드 · 번인 영상 · 공유까지.', icon: <IconDownload /> },
];

const FEATURES = [
  { title: 'Whisper 기반 인식', desc: 'self-hosted large-v3로 한국어 음성을 정확하게 인식합니다.', icon: <IconMic />, span: 'sm:col-span-2', featured: true },
  { title: '표준 SRT 다운로드', desc: '유튜브·편집 프로그램에 바로 쓰는 표준 자막.', icon: <IconDoc /> },
  { title: '브라우저 편집기', desc: '라인 단위 수정 + 영상 위 실시간 미리보기.', icon: <IconEdit /> },
  { title: '번인 자막 영상', desc: '쇼츠·릴스용으로 자막이 박힌 MP4 출력.', icon: <IconFilm /> },
  { title: '공유 링크', desc: '회원은 링크 하나로 자막을 공유·다운로드.', icon: <IconLink /> },
  { title: '프라이버시 우선', desc: '학습 미사용 + 처리 후 원본 자동 삭제. 게스트 1시간 · 회원 30일 후 자동 삭제.', icon: <IconLock />, span: 'sm:col-span-3', wide: true },
];

const USECASES = [
  { title: '유튜브 영상', desc: '롱폼 자막으로 시청 지속·검색 노출↑', icon: <IconFilm /> },
  { title: '온라인 강의', desc: '긴 강의도 자동 자막 + 검수만', icon: <IconDoc /> },
  { title: '쇼츠·릴스', desc: '세로 영상에 번인 자막 박기', icon: <IconMic /> },
  { title: '회의·인터뷰', desc: '말한 내용을 텍스트로 빠르게', icon: <IconEdit /> },
];


const PLATFORMS = [
  'YouTube', 'Instagram 릴스', 'TikTok', 'Shorts', 'Premiere Pro',
  'Final Cut', 'DaVinci Resolve', 'VLC', '곰플레이어', 'Vrew',
];

// CTA 미니 파형 바 (결정적 — 항상 들썩이는 오디오 코어)
const CTA_BARS = Array.from({ length: 28 }, (_, i) => ({
  h: 28 + ((i * 23) % 60),
  d: 0.7 + (i % 5) * 0.12,
  dl: (i % 7) * 0.08,
}));

/* ===================== 컴포넌트 ===================== */

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="scroll-fade mb-8">
      <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-accent" />
        <ShinyText text={eyebrow} />
      </p>
      <h2 className="mt-2.5 text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
        <BlurText text={title} scroll />
      </h2>
    </div>
  );
}

/** HUD 모서리 브래킷 — 시네마틱 히어로의 HUD 결을 본문으로 연결. 다크 패널은 color로 흰색 지정. */
function HudCorners({ color = 'border-border-strong' }: { color?: string }) {
  const base = `pointer-events-none absolute size-3 ${color}`;
  return (
    <span aria-hidden>
      <span className={`${base} -left-1.5 -top-1.5 border-l border-t`} />
      <span className={`${base} -right-1.5 -top-1.5 border-r border-t`} />
      <span className={`${base} -bottom-1.5 -left-1.5 border-b border-l`} />
      <span className={`${base} -bottom-1.5 -right-1.5 border-b border-r`} />
    </span>
  );
}

/** 카드 hover 시 나타나는 HUD 모서리(인셋 — overflow-hidden 카드 내부용). */
function CardHud() {
  const base =
    'pointer-events-none absolute size-3 border-accent/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100';
  return (
    <span aria-hidden>
      <span className={`${base} left-2 top-2 border-l border-t`} />
      <span className={`${base} right-2 top-2 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </span>
  );
}

function Stat({
  value,
  prefix,
  suffix,
  label,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div className="bg-card p-7">
      <p className="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
        <CountUp to={value} prefix={prefix} suffix={suffix} />
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function I({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
function IconUpload() { return <I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12" />; }
function IconMic() { return <I d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z|M19 10v1a7 7 0 0 1-14 0v-1|M12 18v4" />; }
function IconDownload() { return <I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3" />; }
function IconDoc() { return <I d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13h6|M9 17h6" />; }
function IconEdit() { return <I d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />; }
function IconFilm() { return <I d="M3 4h18v16H3z|M7 4v16|M17 4v16|M3 9h4|M17 9h4|M3 15h4|M17 15h4" />; }
function IconLink() { return <I d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />; }
function IconLock() { return <I d="M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4" />; }
