import Script from 'next/script';

/**
 * AdSense 사이트 스크립트(adsbygoogle.js) — **콘텐츠 페이지에만** 렌더.
 *
 * ⚠️ layout(전역)에 두지 말 것. 전역으로 두면 로그인·계정·이력·편집기·업로드 등
 * 게시자 콘텐츠 없는 화면에도 광고 코드가 깔려 AdSense "콘텐츠 없는 화면의 광고"
 * 정책 위반으로 잡힌다. 콘텐츠 페이지(/ · /guide · /faq)에서만 이 컴포넌트를 렌더해
 * 사이트 확인·자동 광고가 콘텐츠 페이지로 한정되게 한다.
 *
 * NEXT_PUBLIC_ADSENSE_CLIENT 미설정 시 아무것도 렌더하지 않는다(graceful).
 */
export function AdsenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';
  if (!client) return null;
  return (
    <Script
      id="adsbygoogle-js"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
