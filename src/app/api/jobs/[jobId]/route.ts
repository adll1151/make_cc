import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';

/**
 * GET /api/jobs/[jobId]
 *
 * 잡 단건 조회. 소유자만 접근 가능.
 * SSE 미지원 클라이언트가 폴링으로 사용.
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
    if (!job) {
      throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    }

    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) {
      throw new AppError('FORBIDDEN', '이 잡에 접근할 권한이 없습니다.');
    }

    // 클라이언트로 보낼 안전한 메타 (storage key 등 내부 정보 일부 마스킹)
    return apiOk({
      jobId: job.id,
      status: job.status,
      progressPercent: job.progressPercent,
      queuePosition: job.queuePosition,
      videoOriginalName: job.videoOriginalName,
      videoDurationSec: job.videoDurationSec,
      hasSubtitle: !!job.subtitleStorageKey,
      language: job.language,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
