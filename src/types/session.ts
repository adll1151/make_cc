/**
 * 잡 소유자 컨텍스트.
 * - user: 로그인한 회원
 * - guest: anonymousId 쿠키로 식별되는 비로그인 사용자
 *
 * 모든 도메인 서비스는 OwnerContext로 권한과 캡을 판단한다.
 */
export type OwnerContext =
  | { kind: 'user'; userId: string; email: string }
  | { kind: 'guest'; anonymousId: string };

export const ANONYMOUS_COOKIE = 'mcc_anon' as const;
export const ANONYMOUS_COOKIE_MAX_AGE_SEC = 365 * 24 * 3600; // 1 year
