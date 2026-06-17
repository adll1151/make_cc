import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Aurora 배경 (고정) */}
      <div className="pointer-events-none fixed inset-0 -z-10 aurora" aria-hidden />

      {/* Grain overlay */}
      <div className="grain-overlay" aria-hidden />

      {/* Scroll progress bar (top) */}
      <div
        className="scroll-progress fixed left-0 top-0 z-[60] h-0.5 w-full origin-left bg-gradient-to-r from-[var(--aurora-purple)] via-[var(--aurora-magenta)] to-[var(--aurora-amber)]"
        aria-hidden
      />

      <FloatingNav />

      {/* ============ HERO ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-40 sm:pt-48">
        <div className="enter-stagger mx-auto max-w-4xl text-center">
          {/* 기능 배지 */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-card/40 px-4 py-1.5 text-sm font-medium backdrop-blur-xl">
              <span className="animate-pulse-glow rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                SRT
              </span>
              <span className="text-muted-foreground">
                한국어 음성 → 자막 자동 생성
              </span>
            </div>
          </div>

          {/* 헤드라인 — editorial display */}
          <h1 className="text-display mt-8 text-6xl sm:text-7xl md:text-8xl">
            <span className="text-gradient">영상 올리면</span>
            <br />
            <span className="text-aurora">한국어 자막</span>
            <span className="text-gradient">이 뚝딱.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
            한국어 음성을 인식해 켜고 끌 수 있는 <strong className="font-semibold text-foreground">SRT 자막</strong>을
            자동으로 만들어드려요. 브라우저에서 미리보기·편집·다운로드·공유까지 한 번에.
          </p>

          {/* CTA */}
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="xl" className="group min-w-56">
              <Link href="/upload">
                지금 영상 올려보기
                <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="xl" className="min-w-56">
              <Link href="/login">회원가입 / 로그인</Link>
            </Button>
          </div>

          {/* 신뢰 인디케이터 */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Indicator>✓ 무료 체험</Indicator>
            <Indicator>✓ 카드 등록 불필요</Indicator>
            <Indicator>✓ 처리 후 자동 삭제</Indicator>
          </div>
        </div>
      </section>

      {/* ============ BENTO GRID ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient">번거로운 자막 작업,</span>
            <br />
            한 번에 끝내세요.
          </h2>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 md:grid-cols-3">
          {/* 큰 카드 (2x2) — Auto STT */}
          <BentoCard
            className="md:col-span-2 md:row-span-2"
            badge="01"
            title="자동 STT (Speech-to-Text)"
            description="Whisper(self-hosted) 기반 한국어 음성 인식. 5분 영상 평균 3분 안에 SRT 자막 완성."
          >
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center p-10">
              <div className="grid w-full max-w-xs grid-cols-12 gap-1">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 12 + ((i * 7) % 32);
                  return (
                    <div
                      key={i}
                      className="rounded-full bg-gradient-to-t from-[var(--aurora-purple)] to-[var(--aurora-magenta)] opacity-80"
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

          {/* 작은 카드 — Edit */}
          <BentoCard badge="02" title="브라우저 편집기" description="미리보기 + 라인 단위 텍스트 수정.">
            <div className="absolute right-4 top-4 font-mono text-xs text-muted-foreground/60">
              <p>00:00:00,000</p>
              <p>00:00:02,400</p>
              <p className="text-foreground/80">안녕하세요.</p>
            </div>
          </BentoCard>

          {/* 작은 카드 — Share */}
          <BentoCard badge="03" title="공유 링크" description="회원은 영구 공유 링크로 다운로드 가능.">
            <div className="absolute right-4 top-4 flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 font-mono text-[10px] text-muted-foreground/60">
              <LinkIcon />
              /s/...
            </div>
          </BentoCard>

          {/* 와이드 카드 (1x3) — Privacy */}
          <BentoCard
            className="md:col-span-3"
            badge="04"
            title="프라이버시 우선"
            description="업로드된 영상은 학습에 사용되지 않으며, 처리 후 자동 삭제됩니다. RLS + 트리거로 DB 레벨에서 보호."
          >
            <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:block">
              <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
                <LockIcon />
                <div>
                  <p className="font-semibold text-success">자동 삭제됨</p>
                  <p className="text-xs text-muted-foreground">게스트 즉시 · 회원 30일</p>
                </div>
              </div>
            </div>
          </BentoCard>
        </div>
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat number="3분" label="5분 영상 평균 처리" />
          <Stat number="< 15%" label="WER (Word Error Rate)" />
          <Stat number="100+" label="지원 영상 포맷 (Whisper)" />
          <Stat number="₩0" label="게스트 무료 체험" />
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-32">
        <div className="bento aurora-subtle relative overflow-hidden p-12 text-center md:p-16">
          <h2 className="text-display text-4xl sm:text-5xl md:text-6xl">
            <span className="text-aurora">지금 바로</span>
            <br />
            <span className="text-gradient">한국어 자막 만들기</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-balance text-muted-foreground">
            영상 하나만 있으면 됩니다. 5분 안에 결과를 받아보세요.
          </p>
          <div className="mt-10">
            <Button asChild variant="gradient" size="xl" className="group">
              <Link href="/upload">
                영상 업로드 시작
                <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
              cc
            </span>
            <span className="font-semibold text-foreground">make_cc</span>
            <span>· 한국어 음성→자막 자동화</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/privacy" className="transition hover:text-foreground">
              개인정보처리방침
            </Link>
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
    <article
      className={`bento group relative flex min-h-[180px] flex-col justify-end overflow-hidden p-6 hover:bento-hover ${className}`}
    >
      {/* 호버 시 spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle at var(--mx,50%) var(--my,30%), color-mix(in oklab, var(--color-primary) 12%, transparent) 0%, transparent 60%)',
        }}
      />

      {children}

      <div className="relative">
        <span className="mb-3 inline-block font-mono text-xs text-muted-foreground/60">{badge}</span>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </article>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="bento flex flex-col items-start justify-center p-6 transition hover:bento-hover">
      <p className="text-display text-4xl text-aurora sm:text-5xl">{number}</p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Indicator({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>;
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
