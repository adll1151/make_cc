import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';
import { presignVideoDownload } from '@/services/storage';

/**
 * GET /api/jobs/[jobId]/video-url
 *
 * private 영상 버킷에서 5분 만료 signed URL 발급.
 * 편집기 페이지가 <video src>로 사용.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const owner = await getOwnerContext();
    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');

    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) throw new AppError('FORBIDDEN', '권한이 없습니다.');

    const url = await presignVideoDownload({
      storageKey: job.videoStorageKey,
      expiresIn: 5 * 60,
    });

    return apiOk({ url, expiresIn: 5 * 60 });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
