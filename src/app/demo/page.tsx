import type { Metadata } from 'next';
import Link from 'next/link';
import { FloatingNav } from '@/components/ui/floating-nav';
import { PageBackground } from '@/components/PageBackground';
import { DemoCaptionPlayer } from '@/components/demo/DemoCaptionPlayer';
import { DEMO_CUES } from '@/data/demo-cues';

export const metadata: Metadata = {
  title: '자막 생성 예시 & 비교 — make_cc 한국어 자막 데모',
  description:
    'make_cc가 자동 생성한 한국어 자막 예시를 직접 보고, 샘플 SRT를 무료로 받아보세요. CapCut·VEED·Vrew·Subtitle Edit과의 비교, 지원 기능, 처리 성능까지 한눈에.',
};

const SAMPLE_SRT = '/samples/make_cc-korean-sample.srt';

export default function DemoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <PageBackground />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-40">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Live Demo</p>
        <h1 className="text-display mt-3 text-4xl sm:text-5xl">
          보고, 비교하고, <span className="text-aurora">직접 받아보세요</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          업로드 전에 결과물을 미리 확인하세요. 아래는 한국어 영상에서 자동 생성된 자막이 영상 위에
          얹혀 재생되는 모습이며, 같은 자막을 표준 <strong className="text-foreground">SRT 파일</strong>로
          바로 받아볼 수 있습니다.
        </p>

        {/* ===== 1. 재생되는 데모 결과 ===== */}
        <div className="mt-8">
          <DemoCaptionPlayer />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/editor/sample"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            샘플로 편집기 체험 →
          </Link>
          <a
            href={SAMPLE_SRT}
            download="make_cc-korean-sample.srt"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-border-strong"
          >
            <DownloadIcon /> 샘플 SRT 다운로드
          </a>
          <Link
            href="/upload"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-border-strong"
          >
            내 영상으로 →
          </Link>
        </div>

        {/* ===== 2. 실제 사용 흐름 (4단계) ===== */}
        <Section label="How it works" title="업로드 한 번, 4단계로 끝">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FlowStep n="01" title="영상 업로드" desc="브라우저에 끌어다 놓기. 설치·로그인 없이 게스트로도 바로 체험.">
              <MockUpload />
            </FlowStep>
            <FlowStep n="02" title="자막 자동 생성" desc="Whisper가 한국어 음성을 인식해 타임코드까지 자동으로.">
              <MockTranscribe />
            </FlowStep>
            <FlowStep n="03" title="브라우저에서 편집" desc="오타·타이밍을 라인 단위로 바로 수정. 영상 위 미리보기.">
              <MockEditor />
            </FlowStep>
            <FlowStep n="04" title="다운로드 · 공유" desc="표준 SRT 다운로드, 번인 영상(MP4), 공유 링크까지.">
              <MockDownload />
            </FlowStep>
          </div>
        </Section>

        {/* ===== 3. 지원 기능 ===== */}
        <Section label="Features" title="단순한 자막 생성기가 아닙니다">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== 4. 왜 make_cc? (차별화 + 비교) ===== */}
        <Section label="Why make_cc" title="왜 make_cc 인가요?">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {EDGES.map((e) => (
              <div key={e} className="flex items-center gap-2.5 rounded-lg bg-subtle/50 px-3.5 py-2.5">
                <CheckMark />
                <span className="text-sm font-medium">{e}</span>
              </div>
            ))}
          </div>

          {/* 비교 표 */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-subtle/50 text-left">
                  <th className="px-4 py-3 font-semibold">기준</th>
                  <th className="px-4 py-3 text-center font-bold text-accent">make_cc</th>
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground">CapCut</th>
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground">VEED</th>
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground">Vrew</th>
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground">Subtitle Edit</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? 'bg-subtle/30' : 'bg-card'}>
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    {row.vals.map((v, j) => (
                      <td
                        key={j}
                        className={`px-3 py-3 text-center ${j === 0 ? 'bg-accent/8 font-semibold' : ''}`}
                      >
                        <Mark v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            ※ 일반적인 사용 방식 기준의 비교이며, 각 서비스의 정책·기능은 변동될 수 있습니다. ●=지원,
            ◐=부분/조건부, ○=미지원 또는 별도 작업 필요.
          </p>
        </Section>

        {/* ===== 5. 신뢰 지표 ===== */}
        <Section label="Performance" title="믿을 수 있는 처리 성능">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="rounded-2xl border border-border bg-card p-5 text-center">
                <p className="text-display text-3xl text-aurora sm:text-4xl">{m.num}</p>
                <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{m.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ 처리 성능 지표는 5분 내외 한국어 영상 기준 평균값입니다. 음질·발음에 따라 달라질 수 있습니다.
          </p>
        </Section>

        {/* ===== 6. 생성된 자막 전체 ===== */}
        <Section label="Output" title="생성된 자막 전체">
          <div className="overflow-hidden rounded-2xl border border-border">
            {DEMO_CUES.map((cue, idx) => (
              <div
                key={cue.time}
                className={`flex gap-4 px-4 py-3 sm:px-5 ${idx % 2 === 0 ? 'bg-card' : 'bg-subtle/40'}`}
              >
                <span className="shrink-0 select-none font-mono text-xs text-muted-foreground/70">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted-foreground/70">
                    {cue.time.replace('-->', '→')}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground sm:text-base">{cue.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            ※ 이 예시는 make_cc의 자막 출력 형식을 보여주기 위한 데모 샘플입니다. 실제 정확도는 영상의
            음질·발음에 따라 달라지며, 생성 후 편집기에서 자유롭게 다듬을 수 있습니다.
          </p>
        </Section>

        {/* CTA */}
        <div className="mt-14 flex flex-wrap items-center gap-4 border-t border-border pt-8 text-sm">
          <Link
            href="/upload"
            className="rounded-full bg-foreground px-5 py-2.5 font-semibold text-background transition hover:opacity-90"
          >
            지금 내 영상 올려보기 →
          </Link>
          <a href={SAMPLE_SRT} download className="text-muted-foreground transition hover:text-foreground">
            샘플 SRT 받기
          </a>
          <Link href="/guide" className="text-muted-foreground transition hover:text-foreground">
            사용법 가이드
          </Link>
          <Link href="/" className="text-muted-foreground transition hover:text-foreground">
            홈으로
          </Link>
        </div>
      </article>
    </main>
  );
}

/* ===================== 데이터 ===================== */

const FEATURES = [
  { icon: '📄', title: '표준 SRT 다운로드', desc: '유튜브·편집 프로그램에 바로 쓰는 표준 자막 파일.' },
  { icon: '✍️', title: '브라우저 자막 편집', desc: '라인 단위 수정 + 영상 위 실시간 미리보기.' },
  { icon: '🔗', title: '공유 링크', desc: '회원은 링크 하나로 자막을 공유·다운로드.' },
  { icon: '⏱️', title: '자동 타임싱크', desc: '음성에 맞춘 타임코드를 자동으로 생성.' },
  { icon: '🎬', title: '번인 자막 영상', desc: '쇼츠·릴스용으로 자막이 박힌 MP4 출력.' },
  { icon: '🎙️', title: 'Whisper 기반 인식', desc: 'self-hosted large-v3, 한국어 음성 인식.' },
  { icon: '🎞️', title: '다양한 포맷 지원', desc: 'MP4·MOV·MKV·WebM 등 대부분의 영상.' },
  { icon: '🔒', title: '개인정보 보호', desc: '학습 미사용 + 처리 후 원본 자동 삭제.' },
];

const EDGES = [
  '로그인 없이 게스트로 바로 사용',
  '설치 없이 브라우저에서',
  '한국어 음성 인식에 최적화',
  '빠른 SRT 생성 (5분 영상 평균 3분)',
  '처리·편집 화면에 광고 없음',
  '업로드 영상 처리 후 자동 삭제',
];

// ● 지원 / ◐ 부분 / ○ 미지원
const COMPARE: { label: string; vals: ('y' | 'p' | 'n')[] }[] = [
  { label: '로그인 없이 사용', vals: ['y', 'n', 'n', 'n', 'y'] },
  { label: '설치 없이 브라우저', vals: ['y', 'n', 'y', 'n', 'n'] },
  { label: '한국어 인식 최적화', vals: ['y', 'p', 'p', 'y', 'n'] },
  { label: '표준 SRT 무료 다운로드', vals: ['y', 'p', 'p', 'y', 'y'] },
  { label: '처리 후 자동 삭제', vals: ['y', 'n', 'p', 'p', 'y'] },
  { label: '번인 자막 영상', vals: ['y', 'y', 'y', 'y', 'n'] },
];

const METRICS = [
  { num: '약 3분', label: '5분 영상 평균 처리' },
  { num: '< 15%', label: 'WER (오인식률)' },
  { num: '100+', label: '지원 영상 포맷' },
  { num: '₩0', label: '게스트 무료 체험' },
];

/* ===================== 컴포넌트 ===================== */

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{label}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function FlowStep({
  n,
  title,
  desc,
  children,
}: {
  n: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="relative mb-4 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-subtle/60">
        {children}
        <span className="absolute left-2.5 top-2.5 flex size-7 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-bold text-background">
          {n}
        </span>
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Mark({ v }: { v: 'y' | 'p' | 'n' }) {
  if (v === 'y') return <span className="font-bold text-success">●</span>;
  if (v === 'p') return <span className="font-bold text-accent">◐</span>;
  return <span className="text-muted-foreground/40">○</span>;
}

function CheckMark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

/* ---- 4단계 미니 목업 (현 디자인 일관) ---- */
function MockUpload() {
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      <span className="rounded-md border border-dashed border-border-strong px-3 py-1 text-xs">video.mp4</span>
    </div>
  );
}
function MockTranscribe() {
  return (
    <div className="flex h-10 items-end gap-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-[var(--aurora-magenta)] to-[var(--color-accent)]"
          style={{ height: `${30 + ((i * 19) % 60)}%` }}
        />
      ))}
    </div>
  );
}
function MockEditor() {
  return (
    <div className="w-[78%] space-y-1.5">
      {['안녕하세요, 여러분', '오늘은 자막 다는 법을'].map((t, i) => (
        <div
          key={t}
          className={`rounded-md border px-2 py-1 text-[11px] ${
            i === 0 ? 'border-accent/40 bg-accent/10 text-foreground' : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {t}
        </div>
      ))}
    </div>
  );
}
function MockDownload() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background">.SRT</span>
      <span className="text-[11px] text-muted-foreground">+ MP4 · 공유 링크</span>
    </div>
  );
}
