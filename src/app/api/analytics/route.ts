import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { getOptionalOwnerContext } from '@/services/auth';
import { recordAnalyticsEvents } from '@/services/analytics';
import { analyticsBatchSchema } from '@/types/analytics';

/**
 * POST /api/analytics — first-party 퍼널 이벤트 수집 (navigator.sendBeacon).
 *
 * 얇은 컨트롤러: Zod 검증 → 소유자 컨텍스트(회원/게스트) → 서비스 위임.
 * 분석은 부가 기능이라 실패해도 사용자 흐름을 막지 않는다.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const body = await req.json().catch(() => null);
    const batch = analyticsBatchSchema.parse(body);
    const owner = await getOptionalOwnerContext();
    await recordAnalyticsEvents({
      batch,
      owner,
      userAgent: req.headers.get('user-agent'),
    });
    return apiOk({ received: batch.events.length });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
