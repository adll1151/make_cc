import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { CountUp } from '@/components/CountUp';
import { Magnetic } from '@/components/motion/Magnetic';
import { SpotlightArticle } from '@/components/motion/SpotlightArticle';
import { Parallax } from '@/components/motion/Parallax';
import { CaptionStory } from '@/components/motion/CaptionStory';
import { EditorPeekCard } from '@/components/motion/EditorPeekCard';

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* 따뜻한 라이트 배경 — 상단 은은한 앰버 글로우 */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 50% at 50% -5%, color-mix(in oklab, var(--color-accent) 14%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="grain-overlay" aria-hidden />
      <div
        className="scroll-progress fixed left-0 top-0 z-[60] h-0.5 w-full origin-left bg-gradient-to-r from-[var(--aurora-magenta)] via-[var(--color-accent)] to-[var(--aurora-amber)]"
        aria-hidden
      />

      <FloatingNav />

      {/* ============ HERO ============ */}
      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-36 sm:pt-44">
        <Parallax className="mx-auto max-w-3xl">
          <div className="enter-stagger text-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium shadow-[var(--shadow-card)]">
                <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
                <span className="text-muted-foreground">한국어 음성 → SRT 자막, 5분 안에</span>
              </span>
            </div>

            <h1 className="text-display mt-8 text-5xl leading-[1.05] sm:text-7xl md:text-8xl">
              <span className="kinetic-word" style={{ animationDelay: '0.05s' }}>
                영상 올리면,
              </span>
              <br />
              <span className="kinetic-word" style={{ animationDelay: '0.22s' }}>
                한국어 <span className="text-aurora">자막</span>
              </span>
              <span className="kinetic-word" style={{ animationDelay: '0.34s' }}>
                이 끝.
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              음성을 인식해 켜고 끌 수 있는 <strong className="font-semibold text-foreground">SRT 자막</strong>을
              자동으로. 브라우저에서 편집·다운로드·공유, 번인 영상까지.
            </p>
          </div>
        </Parallax>

        {/* 드래그/붙여넣기 데모 — 즉시 체험형 히어로 */}
        <div className="enter-fade-up mx-auto mt-12 max-w-2xl" style={{ animationDelay: '0.4s' }}>
          <Link
            href="/upload"
            className="group block rounded-3xl border-2 border-dashed border-border-strong bg-card p-2 shadow-[var(--shadow-card)] transition-all hover:border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className="rounded-2xl bg-subtle/60 p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-transform group-hover:scale-105">
                    <UploadIcon />
                  </span>
                  <div>
                    <p className="font-semibold">영상을 여기에 끌어다 놓기</p>
                    <p className="text-sm text-muted-foreground">MP4 · MOV · MKV · WebM — 클릭해서 올리기</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-bold text-[color-mix(in_oklab,var(--color-accent)_70%,black)]">
                  <CheckBadge /> 자막 정확도 99%
                </span>
              </div>

              {/* 미니 결과 프리뷰 — 박힌 자막 한 컷 */}
              <div className="relative mt-5 aspect-[16/7] overflow-hidden rounded-xl bg-foreground/90">
                <div className="absolute inset-0 opacity-70 aurora-subtle" aria-hidden />
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/75 px-3 py-1.5 text-center text-sm font-bold text-white sm:text-base">
                  영상 속 한국어가 <span className="text-[var(--color-accent)]">자동으로</span> 자막이 됩니다
                </span>
                <span className="absolute left-3 top-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                  CC
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* CTA + 신뢰 지표 */}
        <div className="enter-fade-up mt-8 flex flex-col items-center gap-5" style={{ animationDelay: '0.55s' }}>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Magnetic strength={0.4}>
              <Button asChild variant="default" size="xl" className="group min-w-52">
                <Link href="/upload">
                  무료로 시작하기
                  <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="ghost" size="xl" className="min-w-40">
              <Link href="/guide">사용법 보기</Link>
            </Button>
          </div>
          <Link
            href="/demo"
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
          >
            ▶ 업로드 전에 실제 자막 예시 먼저 보기
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Indicator>✓ 무료 체험</Indicator>
            <Indicator>✓ 카드 등록 불필요</Indicator>
            <Indicator>✓ 처리 후 자동 삭제</Indicator>
          </div>
        </div>
      </section>

      {/* ============ 전체 흐름 (파이프라인) ============ */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="scroll-fade mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            업로드부터 공유까지
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            올리기만 하면, <span className="text-aurora">끝까지 한 번에</span>
          </h2>
        </div>
        <div className="scroll-pop">
          <CaptionStory />
        </div>
      </section>

      {/* ============ 기능 (BENTO) ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="scroll-fade mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            번거로운 자막 작업, <br className="hidden sm:block" />한 번에 끝내세요.
          </h2>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 md:grid-cols-3">
          <BentoCard
            className="scroll-pop md:col-span-2 md:row-span-2"
            badge="01"
            title="자동 STT (Speech-to-Text)"
            description="Whisper(self-hosted) 기반 한국어 음성 인식. 5분 영상 평균 3분 안에 SRT 완성."
          >
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center p-10">
              <div className="grid w-full max-w-xs grid-cols-12 gap-1">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 12 + ((i * 7) % 32);
                  return (
                    <div
                      key={i}
                      className="rounded-full bg-gradient-to-t from-[var(--aurora-magenta)] to-[var(--color-accent)] opacity-80"
                      style={{
                        height: `${h}px`,
                        animation: `float ${1.5 + (i % 5) * 0.3}s ease-in-out infinite`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </BentoCard>

          <EditorPeekCard className="scroll-pop" />

          <BentoCard className="scroll-pop" badge="03" title="공유 링크" description="회원은 영구 공유 링크로 다운로드 가능.">
            <div className="absolute right-4 top-4 flex h-7 animate-float items-center gap-1.5 rounded-full border border-border bg-card px-2 font-mono text-[10px] text-muted-foreground shadow-[var(--shadow-card)]">
              <span className="size-1.5 animate-pulse-glow rounded-full bg-success" />
              <LinkIcon />
              /s/...
            </div>
          </BentoCard>

          <BentoCard
            className="scroll-fade md:col-span-3"
            badge="04"
            title="프라이버시 우선"
            description="업로드된 영상은 학습에 사용되지 않으며, 처리 후 자동 삭제됩니다. RLS + 트리거로 DB 레벨 보호."
          >
            <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 md:block">
              <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
                <LockIcon />
                <div>
                  <p className="font-semibold text-success">자동 삭제됨</p>
                  <p className="text-xs text-muted-foreground">게스트 1시간 · 회원 30일</p>
                </div>
              </div>
            </div>
          </BentoCard>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="scroll-fade grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat number="3분" label="5분 영상 평균 처리" />
          <Stat number="< 15%" label="WER (오인식률)" />
          <Stat number="100+" label="지원 영상 포맷" />
          <Stat number="₩0" label="게스트 무료 체험" />
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative mx-auto max-w-5xl px-6 pb-32">
        <div className="scroll-pop relative overflow-hidden rounded-3xl border border-border bg-card p-12 text-center shadow-[var(--shadow-card)] md:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
            style={{
              background:
                'radial-gradient(50% 80% at 50% 0%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)',
            }}
          />
          <div className="relative">
            <h2 className="text-display text-4xl sm:text-5xl">
              지금 바로 <span className="text-aurora">한국어 자막</span> 만들기
            </h2>
            <p className="mx-auto mt-5 max-w-md text-balance text-muted-foreground">
              영상 하나면 됩니다. 5분 안에 결과를 받아보세요.
            </p>
            <div className="mt-9">
              <Magnetic strength={0.4}>
                <Button asChild variant="default" size="xl" className="group">
                  <Link href="/upload">
                    영상 업로드 시작
                    <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">cc</span>
            <span className="font-semibold text-foreground">make_cc</span>
            <span>· 한국어 음성→자막 자동화</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link href="/demo" className="transition hover:text-foreground">자막 예시 데모</Link>
            <Link href="/blog" className="transition hover:text-foreground">블로그</Link>
            <Link href="/guide" className="transition hover:text-foreground">사용법 가이드</Link>
            <Link href="/faq" className="transition hover:text-foreground">자주 묻는 질문</Link>
            <Link href="/privacy" className="transition hover:text-foreground">개인정보처리방침</Link>
            <span>© 2026 make_cc</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ============ 서브 컴포넌트 ============ */

function BentoCard({
  className = '',
  badge,
  title,
  description,
  children,
}: {
  className?: string;
  badge: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <SpotlightArticle
      className={`bento group relative flex min-h-[180px] flex-col justify-end overflow-hidden p-6 hover:bento-hover ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle at var(--mx,50%) var(--my,30%), color-mix(in oklab, var(--color-accent) 16%, transparent) 0%, transparent 55%)',
        }}
      />
      {children}
      <div className="relative">
        <span className="mb-3 inline-block font-mono text-xs text-muted-foreground/70">{badge}</span>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </SpotlightArticle>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="bento flex flex-col items-start justify-center p-6 transition hover:bento-hover">
      <p className="text-display text-4xl text-aurora sm:text-5xl">
        <CountUp value={number} />
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Indicator({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>;
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
function CheckBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ArrowRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
