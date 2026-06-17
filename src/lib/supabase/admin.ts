import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Service Role 키를 사용하는 어드민 클라이언트.
 * RLS를 우회하므로 워커·관리 작업에서만 사용.
 *
 * 사용 사례:
 *   - 워커: STT 처리 결과를 Job 행에 기록
 *   - 자동 삭제 잡: 만료된 영상 R2 삭제 + DB 정리
 *   - 게스트 글로벌 캡 카운터 증가
 *
 * ⚠️ 절대 클라이언트(브라우저)로 전달 금지.
 *
 * Note: SupabaseClient는 untyped로 유지. 행 타입은 services에서
 * 명시적 `rowToJob` 변환으로 보장. supabase gen types 적용 후 제네릭 도입 예정.
 */

const globalForAdmin = globalThis as unknown as {
  supabaseAdmin: AppSupabaseClient | undefined;
};

export function createAdminClient(): AppSupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. ' +
        '서비스 어드민 클라이언트는 워커/관리 작업 전용입니다.',
    );
  }

  if (globalForAdmin.supabaseAdmin) return globalForAdmin.supabaseAdmin;

  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (env.NODE_ENV !== 'production') {
    globalForAdmin.supabaseAdmin = client;
  }
  return client;
}
