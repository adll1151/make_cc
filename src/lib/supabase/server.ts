import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * 서버 컴포넌트 / Route Handler / Server Actions용 Supabase 클라이언트.
 *
 * 쿠키 기반 세션을 자동 갱신한다 (@supabase/ssr 표준).
 * - 사용자 컨텍스트로 동작 → RLS 정책이 적용됨
 * - service_role이 필요한 작업은 `createAdminClient()` 사용
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component에서 호출 시 set 불가 — middleware가 갱신하므로 무시 가능
          }
        },
      },
    },
  );
}
