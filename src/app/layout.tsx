import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'make_cc — 한국어 영상 자막 자동 생성',
  description:
    '한국어 영상을 업로드하면 음성을 인식해 SRT 자막을 자동으로 만들어드립니다. 미리보기·편집·공유까지.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(0.99 0.002 280)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(0.13 0.02 280)' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Google AdSense 사이트 확인/서빙 스크립트 — client 설정 시에만 모든 페이지 head에 로드 */}
        {env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <Script
            id="adsbygoogle-init"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
          />
        )}
      </head>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
