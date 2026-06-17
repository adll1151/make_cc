import type { NextRequest } from 'next/server';
import { AppError, apiError, getRequestId, handleApiError } from '@/lib/api';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';
import { loadSubtitleText } from '@/services/storage';

/**
 * GET /api/subtitles/[jobId]/download
 *
 * SRT 파일을 첨부(attachment)로 응답. 브라우저가 다운로드 다이얼로그 띄움.
 *
 * RFC 5987 호환:
 *   - filename=   : ASCII fallback (구형 브라우저)
 *   - filename*=  : UTF-8 percent-encoded (현대 브라우저, 한글 등 지원)
 *
 * HTTP 헤더는 ISO-8859-1(Latin-1)만 허용. 한글을 raw로 넣으면 throw.
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

    if (!job.subtitleStorageKey) {
      throw new AppError('NOT_FOUND', '자막이 아직 생성되지 않았습니다.');
    }

    const srtText = await loadSubtitleText(jobId);

    // 파일명 — 원본명에서 확장자 제거
    const baseName = job.videoOriginalName.replace(/\.[^.]+$/, '').slice(0, 80) || 'subtitle';

    // ASCII fallback: 한글·특수문자 → underscore. 결과가 비면 'subtitle'.
    const asciiFallback =
      baseName.replace(/[^\w.\- ]+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '') ||
      'subtitle';

    // UTF-8 인코딩 (현대 브라우저용) — 모든 non-ASCII는 percent-encoded
    const utf8Encoded = encodeURIComponent(baseName);

    const disposition = `attachment; filename="${asciiFallback}.srt"; filename*=UTF-8''${utf8Encoded}.srt`;

    return new Response(srtText, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-subrip; charset=utf-8',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return apiError(err.code, err.message, err.details);
    return handleApiError(err, requestId);
  }
}
