'use server';

import { env } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import type { NotifyChannel } from '@/types/user';
import {
  readDiscordState,
  clearDiscordIdentity,
  setNotifyChannelRow,
  type DiscordState,
} from './user-profile';

/**
 * Discord Account Linking server actions (클라이언트에서 호출).
 *
 * 결과는 throw 대신 { ok } | { error } 객체로 반환 — 서버 액션 에러는
 * 프로덕션에서 메시지가 마스킹되므로, UI가 사유를 안전히 읽도록 한다.
 *
 * 참조: docs/02-design/features/discord-integration.design.md §4.2
 */

export async function getDiscordState(): Promise<DiscordState | null> {
  return readDiscordState();
}

export async function linkDiscord(): Promise<{ url: string } | { error: string }> {
  const supabase = await createServerSupabase();
  const redirectTo =
    env.DISCORD_OAUTH_REDIRECT_URL || `${env.NEXT_PUBLIC_APP_URL}/auth/discord/callback`;

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: { redirectTo },
  });
  if (error || !data?.url) {
    return { error: error?.message ?? 'Discord 연결을 시작하지 못했어요.' };
  }
  return { url: data.url };
}

export async function unlinkDiscord(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  try {
    await clearDiscordIdentity(); // 단일 진실: user_profiles (알림 라우팅 즉시 중단)
  } catch {
    return { error: '연결 해제에 실패했어요.' };
  }

  // best-effort: Supabase identity 분리 (실패해도 라우팅은 이미 멈춤)
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  if (discordIdentity) await supabase.auth.unlinkIdentity(discordIdentity).catch(() => {});

  return { ok: true };
}

export async function setNotifyChannel(
  channel: NotifyChannel,
): Promise<{ ok: true } | { error: string }> {
  const state = await readDiscordState();
  if (!state) return { error: '로그인이 필요합니다.' };
  if ((channel === 'discord' || channel === 'both') && !state.linked) {
    return { error: 'Discord 연결 후 선택할 수 있어요.' };
  }
  try {
    await setNotifyChannelRow(channel);
  } catch {
    return { error: '알림 경로 변경에 실패했어요.' };
  }
  return { ok: true };
}
