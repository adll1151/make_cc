import type { Metadata, Viewport } from 'next';
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
        {/* 테마 초기화 (FOUC 방지) — 저장값 > 시스템 > 라이트(브랜드 기본) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t==='dark'?'theme-dark':'theme-light');}catch(e){document.documentElement.classList.add('theme-light');}})();`,
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/*
          ⚠️ AdSense 스크립트를 여기(전역)에 두지 않는다. 전역 로드 시 로그인·계정·이력·
          편집기·업로드 같은 게시자 콘텐츠 없는 화면에도 광고 코드가 깔려 AdSense 정책
          "콘텐츠 없는 화면의 광고" 위반으로 잡힌다. 대신 콘텐츠 페이지(/ · /guide · /faq)에서만
          <AdsenseScript />로 스크립트를 두고, 그 위에서 <AdSlot />이 광고를 push한다.
        */}
      </head>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
