/**
 * Google AdSense 로더 (공용).
 * adsbygoogle.js를 client(ca-pub-…) 기준으로 1회만 로드.
 * 각 광고 유닛은 <ins class="adsbygoogle"> 렌더 후 adsbygoogle.push({})로 채워짐 (AdSlot 참고).
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsensePromise: Promise<void> | null = null;

/** AdSense 스크립트를 1회만 로드 (레이아웃이 이미 로드했으면 즉시 resolve). */
export function loadAdsense(client: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.adsbygoogle) return Promise.resolve();
  if (adsensePromise) return adsensePromise;
  adsensePromise = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => resolve(); // 실패해도 앱은 계속
    document.head.appendChild(s);
  });
  return adsensePromise;
}
