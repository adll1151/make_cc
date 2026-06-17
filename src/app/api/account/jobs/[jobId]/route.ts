import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { requireUserContext } from '@/services/auth';
import { getJobAdmin, deleteJobAndAssets } from '@/services/jobs';

/**
 * DELETE /api/account/jobs/[jobId]
 *
 * 회원이 자기 잡 + Storage 자산 즉시 삭제 (FR-16).
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const owner = await requireUserContext();
    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    if (job.userId !== owner.userId) {
      throw new AppError('FORBIDDEN', '본인 잡만 삭제 가능합니다.');
    }

    await deleteJobAndAssets(jobId);
    return apiOk({ jobId, deleted: true });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
