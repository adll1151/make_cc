import { Resend } from 'resend';
import { env } from '@/lib/env';

/**
 * Resend (이메일) 클라이언트.
 *
 * 잡 완료·실패 알림 등 Supabase Auth 외 트랜잭션 메일에 사용한다.
 * Supabase Auth의 매직 링크·OAuth 발송은 Supabase가 자체 처리.
 *
 * `RESEND_API_KEY` 미설정 시 `null` — 호출자가 분기.
 */

const globalForResend = globalThis as unknown as { resend: Resend | undefined };

export const resend: Resend | null = env.RESEND_API_KEY
  ? (globalForResend.resend ?? new Resend(env.RESEND_API_KEY))
  : null;

if (env.NODE_ENV !== 'production' && resend) {
  globalForResend.resend = resend;
}

export function isResendEnabled(): boolean {
  return resend !== null;
}
