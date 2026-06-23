import type { MetadataRoute } from 'next';
import { POSTS } from '@/data/blog';

/** sitemap — 색인 대상은 콘텐츠 페이지(랜딩·데모·블로그·가이드·FAQ·개인정보). */
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://makecc.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts: MetadataRoute.Sitemap = POSTS.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.date,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/demo`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/guide`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/faq`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    ...posts,
  ];
}
