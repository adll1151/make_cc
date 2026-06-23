import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FloatingNav } from '@/components/ui/floating-nav';
import { BlogContent } from '@/components/blog/BlogContent';
import { POSTS, getPost } from '@/data/blog';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://makecc.vercel.app';

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: '글을 찾을 수 없습니다 | make_cc' };
  return {
    title: `${post.title} | make_cc`,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `${BASE}/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'make_cc' },
    publisher: { '@type': 'Organization', name: 'make_cc' },
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-2xl px-6 pb-24 pt-32 sm:pt-40">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← 블로그 목록
        </Link>

        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-[color-mix(in_oklab,var(--color-accent)_70%,black)]">
            {post.tag}
          </span>
          <span>{post.readingMin}분 읽기</span>
          <span>·</span>
          <time dateTime={post.date}>{post.date}</time>
        </div>

        <h1 className="text-display mt-4 text-3xl leading-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.description}</p>

        <hr className="my-8 border-border" />

        <BlogContent blocks={post.blocks} />

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-semibold">한국어 영상에 자막, 직접 만들어보세요</p>
          <p className="mt-1 text-sm text-muted-foreground">설치·로그인 없이 브라우저에서 5분이면 끝.</p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            무료로 시작하기 →
          </Link>
        </div>

        {/* 다른 글 */}
        {others.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold tracking-tight">다른 글도 읽어보세요</h2>
            <div className="mt-4 space-y-3">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="block rounded-xl border border-border bg-card p-4 transition hover:border-border-strong"
                >
                  <p className="font-semibold transition hover:text-aurora">{p.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
