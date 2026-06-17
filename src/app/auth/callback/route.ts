import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/**
 * Supabase Auth OAuth / Magic Link 콜백 핸들러.
 *
 * 사용자가 이메일 매직 링크 또는 OAuth 동의 페이지에서 돌아오면
 *   1. ?code 쿼리로 세션 교환
 *   2. 쿠키에 세션 저장
 *   3. ?next (기본 /upload)로 리다이렉트
 *
 * Supabase 대시보드 Auth → URL Configuration에 다음 URL을 등록해야 함:
 *   http://localhost:3000/auth/callback
 *   https://{prod-domain}/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/upload';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL || origin}${next}`);
    }
  }

  // 실패 시 로그인 페이지로
  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL || origin}/login?error=callback`);
}
