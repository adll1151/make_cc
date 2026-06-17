import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getShareByToken, incrementShareHit } from '@/services/share';
import { getJobAdmin } from '@/services/jobs';
import { loadSubtitleText } from '@/services/storage';
import { parseSrt } from '@/lib/srt';
import { shortTimecode } from '@/features/editor';

export const metadata = {
  title: '공유된 자막 — make_cc',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedPage({ params }: PageProps) {
  const { token } = await params;
  const share = await getShareByToken(token);
  if (!share) notFound();
  const job = await getJobAdmin(share.jobId);
  if (!job || job.status !== 'finished' || !job.subtitleStorageKey) notFound();

  // 미리보기용 cue 일부 로드 (앞 10개)
  let previewCues: { index: number; startMs: number; endMs: number; text: string }[] = [];
  try {
    const srt = await loadSubtitleText(share.jobId);
    previewCues = parseSrt(srt).slice(0, 10);
  } catch {
    // 로드 실패는 미리보기 미표시
  }

  // 히트 카운트 (fire-and-forget)
  incrementShareHit(token).catch(() => {});

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="rounded-md bg-foreground px-2 py-1 text-xs font-bold text-background">
            cc
          </span>
          <span>make_cc</span>
        </Link>
      </header>

      <section className="container mx-auto max-w-3xl px-6 pb-16">
        <div className="enter-fade-up">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-card/40 px-3 py-1 text-xs font-medium backdrop-blur-xl">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
            공유된 한국어 자막
          </div>
          <h1 className="text-display mt-6 text-3xl sm:text-4xl md:text-5xl">
            <span className="text-aurora">{job.videoOriginalName}</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            한국어 자막(SRT) · 영상 길이 {Math.round(job.videoDurationSec / 60)}분{' '}
            {job.videoDurationSec % 60}초
          </p>
        </div>

        <div className="enter-fade-up mt-8 flex flex-wrap gap-3">
          <Button asChild variant="gradient" size="lg">
            <a href={`/api/subtitles/${share.jobId}/download`}>SRT 다운로드</a>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/">make_cc 알아보기</Link>
          </Button>
        </div>

        {previewCues.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              미리보기 (앞 {previewCues.length}개 cue)
            </h2>
            <ul className="space-y-2">
              {previewCues.map((c) => (
                <li key={c.index} className="bento p-4">
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    {shortTimecode(c.startMs)} <span className="mx-1 opacity-40">→</span>{' '}
                    {shortTimecode(c.endMs)}
                  </p>
                  <p className="mt-1 leading-relaxed">{c.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              전체 자막은 SRT 다운로드로 확인할 수 있어요.
            </p>
          </div>
        )}

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          영상은 공개되지 않으며, 자막 텍스트만 공유됩니다. ·{' '}
          <Link href="/" className="underline-offset-2 hover:underline">
            나도 자막 만들어보기
          </Link>
        </footer>
      </section>
    </main>
  );
}
