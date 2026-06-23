import type { Metadata } from 'next';
import Link from 'next/link';
import { FloatingNav } from '@/components/ui/floating-nav';
import { PageBackground } from '@/components/PageBackground';
import { POSTS } from '@/data/blog';

export const metadata: Metadata = {
  title: '블로그 — 자막·STT·SRT 가이드 | make_cc',
  description:
    'SRT 파일 사용법, 유튜브 자막 넣는 법, Whisper 음성 인식, SRT와 VTT 차이 등 한국어 자막 제작에 도움 되는 글 모음.',
};

export default function BlogIndexPage() {
  const posts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <PageBackground />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-40">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Blog</p>
        <h1 className="text-display mt-3 text-4xl sm:text-5xl">
          자막 만들기, <span className="text-aurora">제대로 알기</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          SRT·VTT 자막 포맷부터 유튜브 자막 넣는 법, AI 음성 인식까지 — 영상 자막을 다루는 데
          필요한 내용을 쉽게 정리했습니다.
        </p>

        <div className="mt-10 space-y-4">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-2xl border border-border bg-card p-6 transition hover:border-border-strong hover:bento-hover"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-[color-mix(in_oklab,var(--color-accent)_70%,black)]">
                  {p.tag}
                </span>
                <span>{p.readingMin}분 읽기</span>
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight transition group-hover:text-aurora sm:text-2xl">
                {p.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{p.description}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-accent">읽어보기 →</span>
            </Link>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-border pt-8 text-sm">
          <Link
            href="/upload"
            className="rounded-full bg-foreground px-5 py-2.5 font-semibold text-background transition hover:opacity-90"
          >
            자막 만들러 가기 →
          </Link>
          <Link href="/demo" className="text-muted-foreground transition hover:text-foreground">
            자막 예시 데모
          </Link>
          <Link href="/" className="text-muted-foreground transition hover:text-foreground">
            홈으로
          </Link>
        </div>
      </article>
    </main>
  );
}
