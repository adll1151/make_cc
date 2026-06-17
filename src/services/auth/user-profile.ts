import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import type { NotifyChannel } from '@/types/user';

/**
 * user_profiles 사용자 컨텍스트 헬퍼.
 *
 * 신원은 server 클라이언트(getUser, 검증된 세션)로 확인하고, DB 읽기·쓰기는
 * admin 클라이언트로 수행하되 **항상 검증된 user.id로 스코프**한다.
 *   - 코드베이스 규칙: 테이블 write는 admin(createAdminClient) — RLS 우회는 admin에서만.
 *   - SSR 클라이언트(createServerSupabase)는 write 타입이 never로 깨지는 이슈가 있어 read/write 모두 admin 사용.
 *
 * ⚠️ 'use server' 모듈이 아니다 — discord_user_id 등 민감 쓰기는 OAuth 콜백/내부에서만.
 * 참조: docs/02-design/features/discord-integration.design.md §4
 */

type ProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];

export interface DiscordState {
  userId: string;
  linked: boolean;
  discordUsername: string | null;
  notifyChannel: NotifyChannel;
  dmBlocked: boolean;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error('로그인 세션이 없습니다.');
  return id;
}

/** 현재 로그인 사용자의 Discord 연결 상태. 비로그인 시 null. */
export async function readDiscordState(): Promise<DiscordState | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('user_profiles')
    .select('discord_user_id, discord_username, notify_channel, discord_dm_blocked')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    userId,
    linked: !!data?.discord_user_id,
    discordUsername: data?.discord_username ?? null,
    notifyChannel: (data?.notify_channel as NotifyChannel) ?? 'email',
    dmBlocked: Boolean(data?.discord_dm_blocked),
  };
}

/** OAuth 콜백에서만 호출 — 검증된 Discord identity를 본인 프로필에 저장. */
export async function upsertDiscordIdentity(
  discordUserId: string,
  discordUsername: string | null,
): Promise<void> {
  const userId = await requireUserId();
  const admin = createAdminClient();
  const payload: ProfileInsert = {
    user_id: userId,
    discord_user_id: discordUserId,
    discord_username: discordUsername,
    discord_dm_blocked: false,
  };
  const { error } = await admin.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

/** 연결 해제 — discord 필드 null + notify_channel='discord'였으면 email로 강등. */
export async function clearDiscordIdentity(): Promise<void> {
  const userId = await requireUserId();
  const admin = createAdminClient();
  const { data: cur } = await admin
    .from('user_profiles')
    .select('notify_channel')
    .eq('user_id', userId)
    .maybeSingle();
  const notify_channel = cur?.notify_channel === 'discord' ? 'email' : (cur?.notify_channel ?? 'email');

  const payload: ProfileInsert = {
    user_id: userId,
    discord_user_id: null,
    discord_username: null,
    discord_dm_blocked: false,
    notify_channel,
  };
  const { error } = await admin.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

/**
 * 사용자 Pro 구독 여부 (번인 렌더 게이팅용).
 * 프로필이 없거나 미설정이면 false. 검증된 userId로 스코프해 호출.
 * 결제 연동 전: 수동/관리자 토글 (Design §3.3).
 */
export async function readIsPro(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('user_profiles')
    .select('is_pro')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.is_pro);
}

/** 알림 경로 변경 (다른 필드는 보존). */
export async function setNotifyChannelRow(channel: NotifyChannel): Promise<void> {
  const userId = await requireUserId();
  const admin = createAdminClient();
  const payload: ProfileInsert = { user_id: userId, notify_channel: channel };
  const { error } = await admin.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}
