import type { AnalyticsEventName } from '@/types/analytics';

/**
 * first-party 퍼널 트래커 (클라이언트 전용).
 *
 * - 세션 식별: sessionStorage `mcc_sid` (브라우저 세션 단위). 신원(회원/게스트)은 서버가 쿠키로 결정.
 * - 전송: navigator.sendBeacon 우선(페이지 언로드에도 유실 적음) → 실패 시 keepalive fetch.
 * - 분석 실패는 조용히 무시(사용자 흐름에 영향 없음).
 */

const SID_KEY = 'mcc_sid';

function sessionId(): string {
  try {
    let sid = window.sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return 'nostore';
  }
}

type Props = Record<string, string | number | boolean | null>;

export function track(
  event: AnalyticsEventName,
  opts?: { path?: string; jobId?: string; properties?: Props },
): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    sessionId: sessionId(),
    referrer: document.referrer || undefined,
    events: [
      {
        event,
        path: opts?.path ?? window.location.pathname,
        jobId: opts?.jobId,
        properties: opts?.properties,
        ts: Date.now(),
      },
    ],
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/analytics', blob)) return;
    }
  } catch {
    // sendBeacon 실패 → fetch 폴백
  }
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch {
    // 무시
  }
}
