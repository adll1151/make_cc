import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { env } from '@/lib/env';
import { requireUserContext } from '@/services/auth';
import { getJobAdmin } from '@/services/jobs';
import { createShareLink } from '@/services/share';

const bodySchema = z.object({
  jobId: z.string().min(1),
});

/**
 * POST /api/share
 *
 * 회원이 자기 finished 잡에 공유 링크 생성.
 * 이미 활성 토큰이 있으면 재사용 (idempotent).
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const owner = await requireUserContext();
    const { jobId } = bodySchema.parse(await req.json());

    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    if (job.userId !== owner.userId) {
      throw new AppError('FORBIDDEN', '본인 잡만 공유 가능합니다.');
    }
    if (job.status !== 'finished' || !job.subtitleStorageKey) {
      throw new AppError('FORBIDDEN', '자막이 완성된 잡만 공유 가능합니다.');
    }

    const share = await createShareLink({ jobId });
    const url = `${env.NEXT_PUBLIC_APP_URL}/s/${share.token}`;

    return apiOk(
      {
        token: share.token,
        url,
        jobId: share.jobId,
        createdAt: share.createdAt.toISOString(),
        hits: share.hits,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
