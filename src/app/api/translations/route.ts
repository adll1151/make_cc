import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { createTranslation } from '@/services/translation';
import { createTranslationSchema, type CreateTranslationResponse } from './schema';

/**
 * POST /api/translations
 *
 * 자막 번역 요청:
 *   1. 입력 검증 (jobId + 지원 언어)
 *   2. createTranslation: 본인 finished 잡 확인 + 게이팅(무료 잡당 1언어)
 *      + translations(pending) 행 생성 (poll-loop이 픽업)
 *   3. translationId 반환 → 클라이언트는 GET /api/translations/[id]로 폴링
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const log = logger.child({ requestId, route: 'translations' });
  try {
    const body = await req.json();
    const input = createTranslationSchema.parse(body);

    const { translationId } = await createTranslation(input.jobId, {
      targetLang: input.targetLang,
    });

    log.info({ jobId: input.jobId, targetLang: input.targetLang, translationId }, 'translation created');

    const payload: CreateTranslationResponse = { translationId };
    return apiOk(payload, { status: 201 });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
