import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트.
 * 브라우저 쿠키와 localStorage를 통해 세션 관리.
 */

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLIC_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createBrowserSupabase() {
  return createBrowserClient<Database>(PUBLIC_URL, PUBLIC_ANON_KEY);
}
