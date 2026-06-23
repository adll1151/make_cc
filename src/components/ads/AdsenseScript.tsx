import Script from 'next/script';

/**
 * AdSense 사이트 스크립트(adsbygoogle.js) — **텍스트 콘텐츠가 충분한 페이지에만** 렌더.
 *
 * ⚠️ layout(전역)에 두지 말 것. 전역으로 두면 로그인·계정·이력·편집기·업로드 등
 * 게시자 콘텐츠 없는 화면에도 광고 코드가 깔려 AdSense "콘텐츠 없는 화면의 광고"
 * 정책 위반으로 잡힌다. 또한 랜딩(/)은 CTA·모션 위주라 "행동 목적/저가치 화면"으로
 * 판정될 위험이 있어 광고를 두지 않는다. 콘텐츠 페이지(/guide · /faq)에서만 렌더한다.
 *
 * 킬스위치: NEXT_PUBLIC_ADS_ENABLED='false'면 광고 전체 비활성(스크립트 미로드).
 * 미설정/그 외 값이면 활성(기존 동작 유지). 재심사 대기 중 한 번에 끄고 켤 때 사용.
 *
 * NEXT_PUBLIC_ADSENSE_CLIENT 미설정 시에도 아무것도 렌더하지 않는다(graceful).
 */
export function AdsenseScript() {
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false';
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';
  if (!enabled || !client) return null;
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
