import type { MetadataRoute } from 'next';

/**
 * robots.txt — 크롤러(검색·AdSense)가 콘텐츠 페이지(랜딩/개인정보)만 보도록.
 * 유틸/행동 화면(업로드·로그인·계정·이력·편집기·공유토큰·API)과 샌드박스(/test)는
 * 게시자 콘텐츠가 없어 AdSense 정책 위반 소지 → 색인 제외.
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://makecc.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/demo', '/blog', '/guide', '/faq', '/privacy'],
      disallow: ['/test', '/upload', '/login', '/account', '/jobs', '/editor/', '/s/', '/api/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
