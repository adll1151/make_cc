import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin, setThumbnail } from '@/services/jobs';
import { createThumbnailUrl } from '@/services/storage';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5MB (다운스케일 커버 여유)

/**
 * POST /api/jobs/[jobId]/thumbnail
 *
 * 사용자가 편집기에서 고른 컷을 대표 섬네일(포스터)로 지정.
 * body = multipart/form-data 의 `file`(이미지 Blob). 회원 전용·본인 잡만.
 * 서버는 프레임을 재추출하지 않는다(클라가 blob 전달). 성공 시 signed URL 반환.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const owner = await getOwnerContext();
    if (owner.kind !== 'user') {
      throw new AppError('AUTH_REQUIRED', '회원만 포스터를 지정할 수 있어요.');
    }

    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    if (job.userId !== owner.userId) throw new AppError('FORBIDDEN', '권한이 없습니다.');

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      throw new AppError('INVALID_INPUT', '이미지 파일(file)이 필요합니다.');
    }
    if (!file.type.startsWith('image/')) {
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', '이미지 형식만 지원합니다.');
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      throw new AppError('PAYLOAD_TOO_LARGE', '섬네일 이미지가 너무 큽니다.');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { path } = await setThumbnail(jobId, bytes, file.type);
    const url = await createThumbnailUrl({ storageKey: path });

    return apiOk({ url });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}

/**
 * GET /api/jobs/[jobId]/thumbnail
 * 저장된 포스터의 짧은 만료 signed URL. 미지정이면 url=null. 본인 잡만.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const owner = await getOwnerContext();
    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');

    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) throw new AppError('FORBIDDEN', '권한이 없습니다.');

    if (!job.thumbnailPath) return apiOk({ url: null });
    const url = await createThumbnailUrl({ storageKey: job.thumbnailPath });
    return apiOk({ url });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
