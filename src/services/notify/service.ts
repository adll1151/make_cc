import { resend, isResendEnabled } from '@/lib/resend';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobCompletedTemplate, jobFailedTemplate } from './templates';

/**
 * 잡 완료/실패 이메일 알림.
 *
 * 게스트(이메일 없음) → skip. 회원(이메일 있음 + Resend 설정) → 발송.
 * Resend 미설정 시에도 throw하지 않음 (선택 기능).
 */

interface JobNotifyContext {
  jobId: string;
  ownerType: 'user' | 'guest';
  userId: string | null;
  videoOriginalName: string;
  videoDurationSec: number;
}

export async function sendJobCompleted(params: JobNotifyContext & { cueCount: number }) {
  const log = logger.child({ jobId: params.jobId, notify: 'completed' });
  const email = await resolveRecipientEmail(params);
  if (!email) {
    log.info('skip — no recipient (guest 또는 미인증)');
    return { sent: false, reason: 'no-recipient' as const };
  }
  if (!isResendEnabled() || !resend) {
    log.info({ email }, 'skip — Resend 미설정');
    return { sent: false, reason: 'no-resend' as const };
  }

  const tpl = jobCompletedTemplate({
    videoOriginalName: params.videoOriginalName,
    durationSec: params.videoDurationSec,
    cueCount: params.cueCount,
    jobId: params.jobId,
  });

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email],
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    log.info({ messageId: result?.data?.id, email }, 'email sent (completed)');
    return { sent: true as const, messageId: result?.data?.id };
  } catch (err) {
    log.error({ err: (err as Error)?.message }, 'Resend send failed');
    return { sent: false, reason: 'send-failed' as const };
  }
}

export async function sendJobFailed(params: JobNotifyContext & { errorMessage: string }) {
  const log = logger.child({ jobId: params.jobId, notify: 'failed' });
  const email = await resolveRecipientEmail(params);
  if (!email) return { sent: false, reason: 'no-recipient' as const };
  if (!isResendEnabled() || !resend) return { sent: false, reason: 'no-resend' as const };

  const tpl = jobFailedTemplate({
    videoOriginalName: params.videoOriginalName,
    errorMessage: params.errorMessage,
    jobId: params.jobId,
  });

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email],
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    log.info({ messageId: result?.data?.id, email }, 'email sent (failed)');
    return { sent: true as const, messageId: result?.data?.id };
  } catch (err) {
    log.error({ err: (err as Error)?.message }, 'Resend send failed');
    return { sent: false, reason: 'send-failed' as const };
  }
}

async function resolveRecipientEmail(params: JobNotifyContext): Promise<string | null> {
  if (params.ownerType === 'guest' || !params.userId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(params.userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}
