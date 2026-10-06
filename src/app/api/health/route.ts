import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { pingDatabase } from '@/services/health';

/**
 * GET /api/health — 앱 + DB 생존 확인 (공개, 비밀값 없음).
 *
 * GitHub Actions 주기 호출(.github/workflows/supabase-keepalive.yml)로
 * Supabase 무료 티어 비활성 일시정지를 막고, 배포 후 DB 연결 검증에도 쓴다.
 * DB 불통이면 500.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const { dbLatencyMs } = await pingDatabase();
    return apiOk({ status: 'ok', db: 'ok', dbLatencyMs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
