import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { EditorShowcase } from '@/components/landing/EditorShowcase';
import { TranscribeHeadline } from '@/components/landing/TranscribeHeadline';
import { MultiLangCaptions } from '@/components/landing/MultiLangCaptions';
import { BurnInStyles } from '@/components/landing/BurnInStyles';
import { ScrollVelocity } from '@/components/reactbits/ScrollVelocity';
import { SpotlightCard } from '@/components/reactbits/SpotlightCard';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { CountUp } from '@/components/reactbits/CountUp';

/**
 * /test — 랜딩 리디자인 시안 (clean SaaS + 살아있는 제품 데모).
 *
 * 프로덕션 랜딩(`/`)의 시네마틱 HUD 장식(REC·오디오미터·플로팅 터미널·오로라)은 걷어내고,
 * main에 이미 있는 "진짜 제품을 보여주는" 컴포넌트들로 생명감을 채운다:
 *   EditorShowcase(재생되는 편집기) · MultiLangCaptions(실시간 번역 타이핑)
 *   BurnInStyles(호버 라이브 프리뷰) · ScrollVelocity(마퀴) · SpotlightCard · CountUp
 * 이들은 모두 JS 구동이라 reduced-motion 환경에서도 정지하지 않는다.
 *
 * ⚠️ 프로덕션에선 404 (notFound). 확정되면 `/`(marketing/page.tsx)로 이관.
 */
export default function TestLandingPreview() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="relative bg-background text-foreground">
      {/* 시안 표식 */}
      <div className="fixed bottom-4 left-4 z-[60] rounded-full border border-accent/40 bg-card/90 px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-card)] backdrop-blur">
        <span className="mr-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
          시안
        </span>
        clean SaaS 리디자인 · <span className="text-muted-foreground">프로덕션 미반영</span>
      </div>

      <FloatingNav />

      {/* ============ HERO ============ */}
      <section className="relative mx-auto max-w-5xl px-6 pb-16 pt-36 text-center sm:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-16 -z-10 mx-auto h-64 max-w-2xl rounded-full opacity-70 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 75%)',
          }}
        />

        <Link
          href="/guide"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground shadow-[var(--shadow-card)] transition hover:border-border-strong hover:text-foreground"
        >
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
            NEW
          </span>
          소리까지 잡는 진짜 CC · 다국어 자동 번역
          <ArrowRight className="size-3.5" />
        </Link>

        <TranscribeHeadline className="mx-auto mt-7 max-w-3xl text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]" />

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          한국어 음성을 인식해 <span className="font-semibold text-foreground">SRT 자막</span>을 자동으로.
          브라우저에서 편집하고, 영·일·중으로 번역하고, 자막 박은 영상까지 —{' '}
          <span className="font-semibold text-foreground">전부 무료로 시작</span>하세요.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="group min-w-52">
            <Link href="/upload">
              무료로 시작하기
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-40">
            <Link href="/demo">데모 보기</Link>
          </Button>
        </div>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <TrustItem>설치 불필요</TrustItem>
          <TrustItem>로그인 없이 게스트로</TrustItem>
          <TrustItem>카드 등록 없음</TrustItem>
          <TrustItem>처리 후 자동 삭제</TrustItem>
        </ul>

        {/* 제품 미리보기 — 주인공 (실제 영상 재생 + 자막 싱크) */}
        <div className="enter-fade-up relative mt-14 [animation-delay:0.5s]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -top-6 bottom-8 -z-10 rounded-[2rem] opacity-60 blur-2xl"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)',
            }}
          />
          <EditorShowcase />
        </div>
      </section>

      {/* ============ 플랫폼 마퀴 (흐르는 신뢰 스트립) ============ */}
      <section className="py-14">
        <p className="mb-6 text-center text-sm text-muted-foreground">
          만든 <span className="font-semibold text-foreground">SRT 자막</span>, 어디서나 그대로 쓰세요
        </p>
        <ScrollVelocity
          items={PLATFORMS}
          velocity={3}
          itemClassName="text-2xl font-semibold text-muted-foreground/45 sm:text-3xl"
        />
      </section>

      {/* ============ 3단계 ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHead eyebrow="How it works" title="세 단계면 끝." />
        <div className="scroll-fade grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <SpotlightCard
              key={s.n}
              className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
                  {s.icon}
                </span>
                <span className="font-mono text-xs font-bold tracking-widest text-accent">
                  STEP {s.n}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ 리치 CC 차별화 배너 ============ */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="scroll-pop relative overflow-hidden rounded-3xl border border-accent/25 bg-[color-mix(in_oklab,var(--color-accent)_6%,var(--color-card))] p-8 sm:p-12">
          <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
                <IconSound /> 진짜 CC (Closed Caption)
              </p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                대사만이 아니라, <span className="text-accent">소리까지</span> 자막으로.
              </h3>
              <p className="mt-3 max-w-lg text-muted-foreground">
                음악·박수·웃음 같은 비음성 사운드를 감지해 <CcTag>♪ 음악 ♪</CcTag>{' '}
                <CcTag>[웃음]</CcTag>으로 표시합니다. 청각장애인 접근성까지 챙긴 표준 폐쇄자막 —
                기본 켜짐, 무료.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] sm:w-72">
              <CaptionRow time="00:02" text="다들 안녕하세요!" />
              <CaptionRow time="00:04" text="♪ 밝은 배경 음악 ♪" sound />
              <CaptionRow time="00:07" text="와아 (박수)" sound />
              <CaptionRow time="00:09" text="오늘은 자막 얘기예요" active />
            </div>
          </div>
        </div>
      </section>

      {/* ============ 다국어 번역 (실시간 타이핑 데모) ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHead eyebrow="Auto translation" title="자막 하나로, 전 세계로." />
        <MultiLangCaptions />
        <p className="mt-5 text-center text-sm text-muted-foreground">
          한국어 자막을 만들면{' '}
          <span className="font-semibold text-foreground">영어·일본어·중국어로 자동 번역</span> —
          해외 시청자까지 한 번에.
        </p>
      </section>

      {/* ============ 기능 ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHead eyebrow="Features" title="필요한 건 다 있어요." />
        <div className="scroll-fade grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <SpotlightCard
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-accent-foreground">
                {f.icon}
              </span>
              <h3 className="mt-4 font-bold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ============ 번인 자막 스타일 (호버 라이브 프리뷰) ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHead eyebrow="Burn-in styles" title="자막 스타일, 골라서 박기." />
        <BurnInStyles />
        <p className="mt-5 text-center text-sm text-muted-foreground">
          카드에 마우스를 올리면 그 스타일로 자막이 다시 쳐집니다.
        </p>
      </section>

      {/* ============ 통계 ============ */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="scroll-fade grid grid-cols-2 gap-8 rounded-3xl border border-border bg-card px-6 py-10 shadow-[var(--shadow-card)] sm:grid-cols-4">
          <Stat value={30} suffix="초" label="1분 영상 처리" />
          <Stat value={4} suffix="개" label="자막 언어 (한·영·일·중)" />
          <Stat value={4} suffix="종" label="지원 포맷 (MP4·MOV·MKV·WebM)" />
          <Stat value={0} prefix="₩" label="게스트 무료" />
        </div>
      </section>

      {/* ============ 최종 CTA ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="scroll-pop relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)] sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-0 mx-auto h-40 max-w-lg rounded-full opacity-70 blur-3xl"
            style={{
              background:
                'radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 75%)',
            }}
          />
          <h2 className="relative text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            지금 <span className="text-accent">자막</span> 만들기
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-muted-foreground">
            영상 하나면 됩니다. 업로드하고 잠깐이면 자막이 나와요.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="group min-w-52">
              <Link href="/upload">
                영상 업로드 시작
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-40">
              <Link href="/demo">데모 보기</Link>
            </Button>
          </div>
          <p className="relative mt-6 text-xs text-muted-foreground">
            무료 · 카드 등록 불필요 · 처리 후 자동 삭제
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold lowercase text-background">
              cc
            </span>
            <span className="font-semibold">make_cc</span>
            <span className="text-muted-foreground">· 한국어 음성→자막 자동화</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Link href="/demo" className="transition hover:text-foreground">데모</Link>
            <Link href="/blog" className="transition hover:text-foreground">블로그</Link>
            <Link href="/guide" className="transition hover:text-foreground">가이드</Link>
            <Link href="/faq" className="transition hover:text-foreground">FAQ</Link>
            <Link href="/privacy" className="transition hover:text-foreground">개인정보</Link>
            <span className="text-muted-foreground/60">© 2026 make_cc</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ===================== 데이터 ===================== */

const PLATFORMS = [
  'YouTube', 'Instagram 릴스', 'TikTok', 'Shorts', 'Premiere Pro',
  'Final Cut', 'DaVinci Resolve', 'VLC', '곰플레이어', 'Vrew',
];

const STEPS = [
  { n: '01', title: '영상 업로드', desc: '브라우저에 끌어다 놓기. 설치·로그인 없이 게스트로도.', icon: <IconUpload /> },
  { n: '02', title: '자동 자막 생성', desc: 'Whisper가 한국어 음성을 인식해 타임코드까지 자동으로.', icon: <IconMic /> },
  { n: '03', title: '편집 · 다운로드', desc: '라인 단위로 다듬고 SRT 다운로드 · 번인 영상 · 공유까지.', icon: <IconDownload /> },
];

const FEATURES = [
  { title: 'Whisper 기반 인식', desc: 'self-hosted large-v3로 한국어 음성을 정확하게.', icon: <IconMic /> },
  { title: '표준 SRT 다운로드', desc: '유튜브·편집 프로그램에 바로 쓰는 표준 자막.', icon: <IconDoc /> },
  { title: '브라우저 편집기', desc: '라인 단위 수정 + 영상 위 실시간 미리보기.', icon: <IconEdit /> },
  { title: '다국어 자동 번역', desc: '한국어 자막을 영·일·중으로 한 번에 번역.', icon: <IconGlobe /> },
  { title: '번인 자막 영상', desc: '쇼츠·릴스용으로 자막이 박힌 MP4 출력.', icon: <IconFilm /> },
  { title: '공유 링크', desc: '회원은 링크 하나로 자막을 공유·다운로드.', icon: <IconLink /> },
];

/* ===================== 컴포넌트 ===================== */

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="scroll-fade mb-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        <ShinyText text={eyebrow} />
      </p>
      <h2 className="mt-2.5 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{title}</h2>
    </div>
  );
}

function TrustItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <CheckIcon />
      {children}
    </li>
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
    <div className="text-center">
      <p className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
        <CountUp to={value} prefix={prefix} suffix={suffix} />
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function CcTag({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block rounded bg-accent/15 px-1.5 py-0.5 text-sm font-semibold text-accent">
      {children}
    </span>
  );
}

function CaptionRow({
  time,
  text,
  sound,
  active,
}: {
  time: string;
  text: string;
  sound?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        active
          ? 'border-accent/40 bg-accent/10'
          : 'border-border bg-[color-mix(in_oklab,var(--color-subtle)_60%,transparent)]'
      }`}
    >
      <p className="font-mono text-[10px] text-muted-foreground">{time}</p>
      <p
        className={`mt-0.5 text-sm ${
          sound ? 'font-semibold italic text-accent' : active ? 'font-medium' : 'text-muted-foreground'
        }`}
      >
        {text}
      </p>
    </div>
  );
}

/* ===================== 아이콘 ===================== */

function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-success" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
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
function IconGlobe() { return <I d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M2 12h20|M12 2a15 15 0 0 1 0 20|M12 2a15 15 0 0 0 0 20" />; }
function IconFilm() { return <I d="M3 4h18v16H3z|M7 4v16|M17 4v16|M3 9h4|M17 9h4|M3 15h4|M17 15h4" />; }
function IconLink() { return <I d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />; }
function IconSound() { return <I d="M4 10v4|M8 6v12|M12 3v18|M16 8v8|M20 11v2" />; }
