import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { AppError } from '@/lib/api';
import { ANONYMOUS_COOKIE, type OwnerContext } from '@/types/session';

/**
 * 잡 소유자 컨텍스트 추출.
 *
 * 우선순위:
 *   1. Supabase 세션이 있으면 user
 *   2. anonymousId 쿠키가 있으면 guest
 *   3. 둘 다 없으면 throw (middleware가 항상 anonymousId를 보장하므로 정상 흐름에서는 발생하지 않음)
 *
 * Server Components / Route Handlers / Server Actions에서 사용.
 */
export async function getOwnerContext(): Promise<OwnerContext> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user && data.user.email) {
    return { kind: 'user', userId: data.user.id, email: data.user.email };
  }

  const cookieStore = await cookies();
  const anonymousId = cookieStore.get(ANONYMOUS_COOKIE)?.value;
  if (!anonymousId) {
    throw new AppError(
      'AUTH_REQUIRED',
      '익명 세션이 확인되지 않습니다. 페이지를 새로고침해주세요.',
    );
  }
  return { kind: 'guest', anonymousId };
}

/** 회원만 허용 — Route Handler에서 사용 */
export async function requireUserContext(): Promise<
  Extract<OwnerContext, { kind: 'user' }>
> {
  const owner = await getOwnerContext();
  if (owner.kind !== 'user') {
    throw new AppError('AUTH_REQUIRED', '로그인이 필요한 기능입니다.');
  }
  return owner;
}

/** 게스트도 허용 — public이거나 anonymousId가 필요한 핸들러 */
export async function getOptionalOwnerContext(): Promise<OwnerContext | null> {
  try {
    return await getOwnerContext();
  } catch {
    return null;
  }
}
