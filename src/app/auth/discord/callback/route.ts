import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { upsertDiscordIdentity } from '@/services/auth/user-profile';

/**
 * Discord Account Linking 콜백.
 *
 * 매직링크 콜백(/auth/callback)과 경로를 분리해 로그인 흐름과 충돌하지 않게 한다.
 *   1. ?code로 세션 교환 (linkIdentity 결과)
 *   2. user.identities에서 discord identity 추출 → user_profiles에 저장
 *   3. /account 로 리다이렉트 (?discord=linked | error)
 *
 * Discord Developer Portal OAuth2 Redirects + Supabase Auth URL에
 * `{APP_URL}/auth/discord/callback` 등록 필요.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = env.NEXT_PUBLIC_APP_URL || origin;
  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${base}/account?discord=error`);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn({ err: error.message }, 'discord callback: 세션 교환 실패');
    return NextResponse.redirect(`${base}/account?discord=error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const identity = user?.identities?.find((i) => i.provider === 'discord');

  if (user && identity) {
    const idata = (identity.identity_data ?? {}) as Record<string, unknown>;
    const discordUserId =
      (idata.provider_id as string) ?? (idata.sub as string) ?? identity.id;
    const username =
      (idata.user_name as string) ??
      (idata.full_name as string) ??
      (idata.name as string) ??
      null;
    try {
      await upsertDiscordIdentity(discordUserId, username);
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'discord callback: 프로필 저장 실패');
      return NextResponse.redirect(`${base}/account?discord=error`);
    }
  }

  return NextResponse.redirect(`${base}/account?discord=linked`);
}
