import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { requireUserContext } from '@/services/auth';
import { getJobAdmin } from '@/services/jobs';
import { getShareByToken, revokeShareLink } from '@/services/share';

/**
 * GET /api/share/[token]  (공개)
 *
 * 공유 페이지가 호출. token이 인증 역할.
 * 영상 정보는 노출하지 않고 자막 다운로드만 허용.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const requestId = getRequestId(req);
  const { token } = await ctx.params;

  try {
    const share = await getShareByToken(token);
    if (!share) {
      throw new AppError('NOT_FOUND', '공유 링크가 만료되었거나 폐기되었습니다.');
    }

    const job = await getJobAdmin(share.jobId);
    if (!job || job.status !== 'finished' || !job.subtitleStorageKey) {
      throw new AppError('NOT_FOUND', '자막이 없습니다.');
    }

    // 영상 메타는 최소만 노출
    return apiOk({
      jobId: share.jobId,
      videoOriginalName: job.videoOriginalName,
      videoDurationSec: job.videoDurationSec,
      language: job.language,
      sharedAt: share.createdAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}

/**
 * DELETE /api/share/[token]  (회원만)
 *
 * 자기 토큰 폐기.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const requestId = getRequestId(req);
  const { token } = await ctx.params;

  try {
    const owner = await requireUserContext();
    const share = await getShareByToken(token);
    if (!share) throw new AppError('NOT_FOUND', '공유 링크를 찾을 수 없습니다.');
    const job = await getJobAdmin(share.jobId);
    if (!job || job.userId !== owner.userId) {
      throw new AppError('FORBIDDEN', '본인 공유 링크만 폐기 가능합니다.');
    }
    await revokeShareLink({ token });
    return apiOk({ ok: true });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
