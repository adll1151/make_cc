/**
 * AdCash aclib 로더 (공용).
 * runBanner(배너 슬롯) / runAutoTag(페이지 자동 배치) 모두 이 스크립트를 사용.
 */

declare global {
  interface Window {
    aclib?: {
      runBanner: (opts: { zoneId: string }) => void;
      runAutoTag: (opts: { zoneId: string }) => void;
    };
  }
}

let aclibPromise: Promise<void> | null = null;

/** acscdn aclib 스크립트를 1회만 로드. */
export function loadAclib(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.aclib) return Promise.resolve();
  if (aclibPromise) return aclibPromise;
  aclibPromise = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://acscdn.com/script/aclib.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // 실패해도 앱은 계속
    document.head.appendChild(s);
  });
  return aclibPromise;
}
