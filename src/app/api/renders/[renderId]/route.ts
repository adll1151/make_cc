import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { getRender } from '@/services/render';
import type { RenderStatusResponse } from '../schema';

/**
 * GET /api/renders/[renderId]
 *
 * 렌더 진행 상태 폴링:
 *   - 본인 잡의 렌더만 조회 (소유 검증)
 *   - status: pending | rendering | done | failed
 *   - done이면 출력 MP4 signed URL(downloadUrl) 포함
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ renderId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const { renderId } = await ctx.params;
    const view = await getRender(renderId);
    const payload: RenderStatusResponse = view;
    return apiOk(payload);
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
