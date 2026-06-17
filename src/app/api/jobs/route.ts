import type { NextRequest } from 'next/server';
import { apiOk, getRequestId, handleApiError } from '@/lib/api';
import { requireUserContext } from '@/services/auth';
import { listMyJobs } from '@/services/jobs';

/**
 * GET /api/jobs
 *
 * 회원 이력 — RLS로 자기 잡만 자동 필터.
 * 게스트는 401 (이력 개념 없음).
 *
 * Query:
 *   ?limit=20  (default 20, max 50)
 *   ?offset=0
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    await requireUserContext();

    const url = new URL(req.url);
    const limit = clamp(Number(url.searchParams.get('limit') ?? 20), 1, 50);
    const offset = clamp(Number(url.searchParams.get('offset') ?? 0), 0, 10_000);

    const jobs = await listMyJobs({ limit, offset });

    return apiOk({
      jobs: jobs.map((j) => ({
        jobId: j.id,
        status: j.status,
        progressPercent: j.progressPercent,
        videoOriginalName: j.videoOriginalName,
        videoDurationSec: j.videoDurationSec,
        videoSizeBytes: j.videoSizeBytes,
        hasSubtitle: !!j.subtitleStorageKey,
        hasVideo: !!j.videoStorageKey,
        videoDeleteAt: j.videoDeleteAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        finishedAt: j.finishedAt?.toISOString() ?? null,
        errorMessage: j.errorMessage,
      })),
      pagination: { limit, offset, returned: jobs.length },
    });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
