import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { getTranslation } from '@/services/translation';
import type { TranslationStatusResponse } from '../schema';

/**
 * GET /api/translations/[translationId]
 *
 * 번역 진행 상태 폴링:
 *   - 본인 잡의 번역만 조회 (소유 검증)
 *   - status: pending | translating | done | failed
 *   - done이면 번역 SRT signed URL(downloadUrl) 포함
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ translationId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const { translationId } = await ctx.params;
    const view = await getTranslation(translationId);
    const payload: TranslationStatusResponse = view;
    return apiOk(payload);
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
