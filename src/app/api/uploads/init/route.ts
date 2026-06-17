import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { assertCanUpload } from '@/services/auth/guards';
import { createJob, markUploading } from '@/services/jobs';
import { plannedVideoStorageKey, requestVideoUpload } from '@/services/storage';
import { uploadInitSchema, type UploadInitResponse } from './schema';

/**
 * POST /api/uploads/init
 *
 * 영상 업로드 시작:
 *   1. owner 컨텍스트 (회원 / 게스트) 식별
 *   2. 캡 가드 (MIME, 크기, 길이, 게스트 글로벌 일일 캡)
 *   3. jobId 사전 생성 → storage key 결정
 *   4. jobs 테이블에 'pending' 행 생성
 *   5. Supabase Storage signed upload URL 발급 → 클라이언트로 반환
 *
 * 클라이언트는 받은 uploadUrl + token으로 직접 PUT 한다.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const log = logger.child({ requestId, route: 'uploads/init' });
  try {
    const body = await req.json();
    const intent = uploadInitSchema.parse(body);

    const owner = await getOwnerContext();

    await assertCanUpload(owner, {
      fileSizeBytes: intent.fileSize,
      durationSec: intent.durationSec,
      mimeType: intent.mimeType,
    });

    const jobId = crypto.randomUUID();
    const storageKey = plannedVideoStorageKey(jobId, intent.fileName);

    const job = await createJob({
      id: jobId,
      ownerType: owner.kind === 'user' ? 'user' : 'guest',
      ownerId: owner.kind === 'user' ? owner.userId : owner.anonymousId,
      userId: owner.kind === 'user' ? owner.userId : null,
      videoOriginalName: intent.fileName,
      videoSizeBytes: intent.fileSize,
      videoDurationSec: intent.durationSec,
      videoStorageKey: storageKey,
    });

    const ticket = await requestVideoUpload({ jobId: job.id, fileName: intent.fileName });

    // I-1: pending → uploading 전이. /complete 라우트가 uploading → queued로 받음.
    await markUploading(job.id);

    log.info({ jobId: job.id, ownerType: owner.kind }, 'upload init ok');

    const payload: UploadInitResponse = {
      jobId: job.id,
      uploadUrl: ticket.uploadUrl,
      token: ticket.token,
      bucket: ticket.bucket,
      path: ticket.path,
      expiresIn: ticket.expiresIn,
    };
    return apiOk(payload, { status: 201 });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
