import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { cancelJob, getJobAdmin } from '@/services/jobs';
import { removeFromQueue } from '@/services/queue';

/**
 * POST /api/jobs/[jobId]/cancel
 *
 * 비종결 잡을 취소 (state-machine: 어느 비종결에서든 cancelled로 전이).
 * 큐에서도 제거 (Redis 있으면).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;
  const log = logger.child({ requestId, route: 'jobs/cancel', jobId });

  try {
    const owner = await getOwnerContext();
    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');

    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) throw new AppError('FORBIDDEN', '권한이 없습니다.');

    // 1. 큐 제거 (Redis 없으면 silent fail 허용)
    await removeFromQueue(jobId).catch((err) => {
      log.warn({ err: (err as Error)?.message }, 'queue remove failed (ok if no redis)');
    });

    // 2. 상태 전이 — cancelJob이 이미 종결 검사 함
    const updated = await cancelJob(jobId);
    log.info({ from: job.status, to: updated.status }, 'cancelled');

    return apiOk({ jobId, status: updated.status });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
