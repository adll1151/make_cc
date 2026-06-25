import { type CSSProperties } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { EditorShowcase } from '@/components/landing/EditorShowcase';
import { CinematicHero } from '@/components/landing/CinematicHero';
import { BlurText } from '@/components/reactbits/BlurText';
import { CountUp } from '@/components/reactbits/CountUp';
import { ScrollVelocity } from '@/components/reactbits/ScrollVelocity';
import { Magnet } from '@/components/reactbits/Magnet';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { SpotlightCard } from '@/components/reactbits/SpotlightCard';
import { BackgroundGradientAnimation } from '@/components/reactbits/BackgroundGradientAnimation';

export default function LandingPage() {
  return (
    <main className="relative">
      {/* 꾸민 배경 — Aceternity Background Gradient Animation (단일 레이어, 절제) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-80" aria-hidden>
        <BackgroundGradientAnimation />
      </div>

      <FloatingNav />

      {/* ============ HERO — 시네마틱 HUD (스크롤 시네마틱) ============ */}
      <CinematicHero />

      {/* ============ 제품 쇼케이스 ============ */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-16">
        <p className="mb-5 text-center text-sm text-muted-foreground">
          무료 체험 · 카드 등록 불필요 · 처리 후 자동 삭제
        </p>
        <div className="scroll-pop">
          <EditorShowcase />
        </div>
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

      {/* ============ 통계 ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="scroll-fade grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          <Stat value={3} suffix="분" label="5분 영상 평균 처리" />
          <Stat value={15} prefix="< " suffix="%" label="WER (오인식률)" />
          <Stat value={100} suffix="+" label="지원 영상 포맷" />
          <Stat value={0} prefix="₩" label="게스트 무료" />
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

      {/* ============ 번인 자막 스타일 ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <SectionHead eyebrow="Burn-in styles" title="자막 스타일, 골라서 박기" />
        <div className="scroll-fade grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STYLES.map((st) => (
            <SpotlightCard
              key={st.label}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="relative mb-3 grid aspect-video place-items-center overflow-hidden rounded-lg bg-[#0c0c11]">
                <div className="absolute inset-0 opacity-40 aurora-subtle" aria-hidden />
                <span className="absolute left-2 top-2 rounded bg-accent px-1 py-0.5 text-[8px] font-bold text-accent-foreground">CC</span>
                <span className={`relative rounded px-2 py-1 text-xs font-extrabold ${st.cls}`}>가나다 자막</span>
              </div>
              <p className="text-sm font-bold tracking-tight">{st.label}</p>
              <p className="text-xs text-muted-foreground">{st.sub}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="scroll-pop rounded-3xl border border-border bg-card px-6 py-16 text-center sm:py-20">
          <h2 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
            지금 <span className="text-accent">자막</span> 만들기
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            영상 하나면 됩니다. 5분 안에 결과를 받아보세요.
          </p>
          <div className="mt-8 flex justify-center">
            <Magnet padding={70} magnetStrength={4}>
              <Button asChild size="xl" className="group">
                <Link href="/upload">
                  영상 업로드 시작
                  <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </Magnet>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">cc</span>
            <span className="font-semibold text-foreground">make_cc</span>
            <span>· 한국어 음성→자막 자동화</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link href="/demo" className="transition hover:text-foreground">데모</Link>
            <Link href="/blog" className="transition hover:text-foreground">블로그</Link>
            <Link href="/guide" className="transition hover:text-foreground">가이드</Link>
            <Link href="/faq" className="transition hover:text-foreground">FAQ</Link>
            <Link href="/privacy" className="transition hover:text-foreground">개인정보</Link>
            <span>© 2026 make_cc</span>
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

const STYLES = [
  { label: '깔끔', cls: 'bg-white text-black', sub: '흰 자막' },
  { label: '볼드 옐로', cls: 'bg-black text-[#ffd34d]', sub: '쇼츠·릴스' },
  { label: '박스', cls: 'bg-accent text-black', sub: '강조 박스' },
  { label: '예능', cls: 'bg-black text-white ring-2 ring-[#ffd34d]', sub: '외곽선' },
];

const PLATFORMS = [
  'YouTube', 'Instagram 릴스', 'TikTok', 'Shorts', 'Premiere Pro',
  'Final Cut', 'DaVinci Resolve', 'VLC', '곰플레이어', 'Vrew',
];

/* ===================== 컴포넌트 ===================== */

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="scroll-fade mb-8">
      <p className="text-sm font-semibold uppercase tracking-widest">
        <ShinyText text={eyebrow} />
      </p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
        <BlurText text={title} scroll />
      </h2>
    </div>
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
