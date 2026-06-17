/**
 * 알림 라우팅용 프로필 조회 (admin/service_role — RLS 우회).
 *
 * 워커·시스템 컨텍스트에서 dispatcher가 사용한다.
 * 행이 없으면(미연결/프로필 미생성) email 기본값으로 간주 → 기존 이메일 동작 유지.
 *
 * 참조: docs/02-design/features/discord-integration.design.md §4.5
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import type { NotifyChannel, NotifyProfile } from '@/types/user';

const EMAIL_FALLBACK: NotifyProfile = {
  notifyChannel: 'email',
  discordUserId: null,
  discordDmBlocked: false,
};

export async function getUserNotifyProfile(userId: string): Promise<NotifyProfile> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('user_profiles')
    .select('notify_channel, discord_user_id, discord_dm_blocked')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.child({ userId }).warn({ err: error.message }, 'user_profiles 조회 실패 — email fallback');
    return EMAIL_FALLBACK;
  }
  if (!data) return EMAIL_FALLBACK;

  return {
    notifyChannel: (data.notify_channel as NotifyChannel) ?? 'email',
    discordUserId: data.discord_user_id ?? null,
    discordDmBlocked: Boolean(data.discord_dm_blocked),
  };
}

/** Discord 50007(DM 차단) 감지 시 dm_blocked 마크 (best-effort). */
export async function markDmBlocked(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profiles')
    .update({ discord_dm_blocked: true })
    .eq('user_id', userId);
  if (error) {
    logger.child({ userId }).warn({ err: error.message }, 'dm_blocked 마크 실패');
  }
}
