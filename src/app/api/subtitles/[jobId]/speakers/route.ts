import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin, updateSpeakerMap } from '@/services/jobs';

/**
 * PUT /api/subtitles/[jobId]/speakers
 *
 * 화자 표시 이름(speaker_map) 갱신. 편집기에서 "화자 1 → 김지훈" 변경 시 호출.
 * body: { speakerMap: { spk_0: '이름', ... } }
 */
const schema = z.object({
  speakerMap: z.record(z.string(), z.string().max(40)),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const owner = await getOwnerContext();
    const job = await getJobAdmin(jobId);
    if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) throw new AppError('FORBIDDEN', '권한이 없습니다.');

    const { speakerMap } = schema.parse(await req.json());
    // 빈 문자열 이름은 제거(기본 라벨로 표시). 트림.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(speakerMap)) {
      const name = v.trim();
      if (name.length > 0) cleaned[k] = name;
    }
    await updateSpeakerMap(jobId, cleaned);

    return apiOk({ jobId, speakerMap: cleaned });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}
