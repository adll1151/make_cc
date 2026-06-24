import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { createRender } from '@/services/render';
import { createRenderSchema, type CreateRenderResponse } from './schema';

/**
 * POST /api/renders
 *
 * 번인 영상 내보내기 요청:
 *   1. 입력 검증 (jobId + 비율/화질/스타일)
 *   2. createRender: 본인 finished 잡 확인 + is_pro 게이팅(워터마크/해상도 강제)
 *      + renders(pending) 행 생성 + 큐 인입
 *   3. renderId 반환 → 클라이언트는 GET /api/renders/[renderId]로 폴링
 *
 * 게이팅(무료=워터마크+720 / Pro=제거+≤1080)은 services/render에서 강제.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const log = logger.child({ requestId, route: 'renders' });
  try {
    const body = await req.json();
    const input = createRenderSchema.parse(body);

    const { renderId } = await createRender(input.jobId, {
      aspect: input.aspect,
      resolution: input.resolution,
      style: input.style,
      subtitleLang: input.subtitleLang,
    });

    log.info({ jobId: input.jobId, renderId }, 'render created');

    const payload: CreateRenderResponse = { renderId };
    return apiOk(payload, { status: 201 });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
