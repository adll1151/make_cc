import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin, markUploaded } from '@/services/jobs';
import { enqueueTranscribe } from '@/services/queue';
import { maybeAlertWorkerDown } from '@/services/notify';

/**
 * POST /api/uploads/[uploadId]/complete
 *
 * 클라이언트가 Supabase Storage로 PUT을 완료한 후 호출.
 *   1. owner 검증 (해당 잡 소유자만)
 *   2. uploading → queued 전이 (markUploaded — 자동 게스트 카운터 증가)
 *   3. BullMQ enqueue (graceful — 실패해도 응답은 OK)
 *
 * 응답: { jobId, status: 'queued', enqueued: boolean }
 *
 * Note: 라우트 파라미터 `uploadId`는 실제로는 jobId (init이 jobId를 발급해 storage path에 포함).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ uploadId: string }> },
) {
  const requestId = getRequestId(req);
  const { uploadId: jobId } = await ctx.params;
  const log = logger.child({ requestId, route: 'uploads/complete', jobId });

  try {
    const owner = await getOwnerContext();

    const job = await getJobAdmin(jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.', { jobId });
    }

    // 소유자 검증
    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) {
      throw new AppError('FORBIDDEN', '이 잡에 접근할 권한이 없습니다.');
    }

    // 멱등성: 이미 queued 이상이면 바로 응답
    if (job.status !== 'uploading') {
      log.info({ status: job.status }, 'already past uploading, idempotent ok');
      return apiOk({ jobId, status: job.status, enqueued: false });
    }

    // 상태 전이 (uploading → queued + 이벤트 + 게스트 카운터)
    const updated = await markUploaded(jobId);
    log.info({ status: updated.status }, 'transition uploading → queued');

    // 큐잉 (Redis 없으면 false, polling worker가 처리)
    const enqueued = await enqueueTranscribe({
      jobId,
      ownerType: updated.ownerType,
    });
    log.info({ enqueued }, 'enqueue attempted');

    // 워커가 꺼져 있는 것 같으면 운영자에게 1회 알림(켜라고).
    // serverless에서 응답 후 동결로 누락되지 않게 await(미설정 시 즉시 반환, throw 안 함).
    await maybeAlertWorkerDown({ jobId, videoOriginalName: job.videoOriginalName });

    return apiOk({ jobId, status: 'queued', enqueued });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
