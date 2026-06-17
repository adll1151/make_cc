/**
 * 알림 dispatcher — user_profiles.notify_channel 기준으로 Email/Discord/both 분기.
 *
 * 워커·웹 어디서 알림이 나가든 이 함수 하나만 호출한다 (단일 진입점).
 * 기존 이메일 전송기(`./service`)를 재사용하므로 이메일 경로 회귀 없음.
 *
 * 멱등 가드('notified' 이벤트 중복 방지)와 job_events 기록을 이 dispatcher가 직접 수행한다
 * (hasJobEvent로 skip → 발송 → appendJobEvent). 어떤 호출자든 중복 발송이 방지된다.
 *
 * 참조: docs/02-design/features/discord-integration.design.md §2.2(C) / §4.5 / §6.2
 */

import { logger } from '@/lib/logger';
import type { NotifyResult } from '@/types/user';
import type { Json } from '@/lib/supabase/database.types';
import { appendJobEvent, hasJobEvent } from '@/services/jobs/events';
import { getUserNotifyProfile, markDmBlocked } from './profile';
import { sendJobCompleted, sendJobFailed } from './service';
import { sendDiscordDM } from './discord';
import { toDiscordCompletedMessage, toDiscordFailedMessage } from './format';

interface JobNotifyContext {
  jobId: string;
  ownerType: 'user' | 'guest';
  userId: string | null;
  videoOriginalName: string;
  videoDurationSec: number;
}

type EmailSendResult = { sent: boolean; reason?: string };

function emailResult(r: EmailSendResult): NotifyResult {
  return {
    channel: 'email',
    ok: r.sent,
    reason: r.sent ? undefined : (r.reason as NotifyResult['reason']),
  };
}

export async function dispatchJobCompleted(
  ctx: JobNotifyContext & { cueCount: number },
): Promise<NotifyResult[]> {
  return dispatch(ctx, {
    email: () => sendJobCompleted(ctx),
    discord: (discordUserId) =>
      sendDiscordDM(
        discordUserId,
        toDiscordCompletedMessage({ videoOriginalName: ctx.videoOriginalName, jobId: ctx.jobId }),
      ),
  });
}

export async function dispatchJobFailed(
  ctx: JobNotifyContext & { errorMessage: string },
): Promise<NotifyResult[]> {
  return dispatch(ctx, {
    email: () => sendJobFailed(ctx),
    discord: (discordUserId) =>
      sendDiscordDM(
        discordUserId,
        toDiscordFailedMessage({
          videoOriginalName: ctx.videoOriginalName,
          errorMessage: ctx.errorMessage,
          jobId: ctx.jobId,
        }),
      ),
  });
}

interface Channels {
  email: () => Promise<EmailSendResult>;
  discord: (discordUserId: string) => Promise<NotifyResult>;
}

async function dispatch(ctx: JobNotifyContext, channels: Channels): Promise<NotifyResult[]> {
  const log = logger.child({ jobId: ctx.jobId, notify: 'dispatch' });

  // 멱등 가드: 워커 재시도 등으로 동일 잡이 다시 들어오면 중복 발송 방지
  if (await hasJobEvent(ctx.jobId, 'notified')) {
    log.info('이미 알림 발송된 잡 — 멱등 skip');
    return [];
  }

  const out: NotifyResult[] = [];

  if (ctx.ownerType === 'guest' || !ctx.userId) {
    // 게스트/미인증 → 이메일 전송기가 no-recipient 처리 (기존 동작)
    out.push(emailResult(await channels.email()));
  } else {
    const profile = await getUserNotifyProfile(ctx.userId);

    if (profile.notifyChannel === 'email' || profile.notifyChannel === 'both') {
      out.push(emailResult(await channels.email()));
    }

    const canDiscord =
      (profile.notifyChannel === 'discord' || profile.notifyChannel === 'both') &&
      !!profile.discordUserId &&
      !profile.discordDmBlocked;

    if (canDiscord) {
      const r = await channels.discord(profile.discordUserId as string);
      out.push(r);

      if (r.reason === 'blocked') await markDmBlocked(ctx.userId);

      // discord 단독인데 실패 → 이메일 fallback (both는 이미 위에서 발송됨)
      if (!r.ok && profile.notifyChannel === 'discord') {
        log.info({ reason: r.reason }, 'discord 실패 — 이메일 fallback');
        out.push(emailResult(await channels.email()));
      }
    }
  }

  // 발송 기록 (append-only) — 멱등 가드의 기준
  const results = out.map((r) => ({ channel: r.channel, ok: r.ok, reason: r.reason ?? null }));
  await appendJobEvent({
    jobId: ctx.jobId,
    type: 'notified',
    payload: { results } as unknown as Record<string, Json>,
  }).catch((e) => log.warn({ err: (e as Error).message }, 'notified 이벤트 기록 실패'));

  return out;
}
