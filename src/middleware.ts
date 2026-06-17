import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ANONYMOUS_COOKIE, ANONYMOUS_COOKIE_MAX_AGE_SEC } from '@/types/session';

/**
 * 모든 요청에 대해:
 *   1. Supabase 세션 쿠키 갱신 (만료 임박 시 자동 refresh)
 *   2. anonymousId 쿠키 보장 (없으면 발급)
 *   3. x-request-id 헤더 주입 (로그 상관관계)
 *
 * @supabase/ssr의 권장 미들웨어 패턴을 따른다.
 * Server Component에서는 set이 불가능하므로 여기서 갱신이 필수.
 */

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 요청에 적용:
     *   - _next/static, _next/image
     *   - favicon
     *   - 공개 정적 파일
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  // x-request-id를 다운스트림에도 전달
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  let res = NextResponse.next({ request: { headers: requestHeaders } });

  // 1. Supabase 세션 쿠키 갱신
  //    env가 비어있으면(로컬 미설정) skip → 랜딩만 보는 상황 허용
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>,
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          res = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    // 세션 조회만 해도 쿠키 갱신이 트리거됨
    await supabase.auth.getUser();
  }

  // 2. anonymousId 쿠키 보장 (HTTP-only, SameSite=Lax)
  const existing = req.cookies.get(ANONYMOUS_COOKIE)?.value;
  if (!existing || existing.length < 16) {
    const anonymousId = crypto.randomUUID();
    res.cookies.set(ANONYMOUS_COOKIE, anonymousId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ANONYMOUS_COOKIE_MAX_AGE_SEC,
    });
  }

  res.headers.set('x-request-id', requestId);
  return res;
}
