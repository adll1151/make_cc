import type { MetadataRoute } from 'next';

/** sitemap — 색인 대상은 콘텐츠 페이지(랜딩·개인정보처리방침)만. */
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://makecc.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
