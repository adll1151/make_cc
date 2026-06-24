import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { listTranslationsByJob } from '@/services/translation';
import type { TranslationView } from '@/types/translation';

/**
 * GET /api/jobs/[jobId]/translations
 *
 * 잡의 번역 트랙 목록 (편집기 언어 탭). 본인 잡만 (소유 검증).
 * done 트랙은 downloadUrl 포함.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const { jobId } = await ctx.params;
    const items = await listTranslationsByJob(jobId);
    const payload: TranslationView[] = items;
    return apiOk(payload);
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
