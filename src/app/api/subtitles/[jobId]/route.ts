import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { apiOk, AppError, getRequestId, handleApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';
import { loadSubtitleText, saveSubtitle, getWordsJson } from '@/services/storage';
import { buildSrt, parseSrt, validateCues, normalizeCues } from '@/lib/srt';
import type { Cue } from '@/types/subtitle';

/**
 * GET /api/subtitles/[jobId]
 *
 * SRT 본문을 cue 배열로 응답 (편집기 module-9가 사용).
 *
 * 응답 200:
 *   { jobId, language, cues: [{ index, startMs, endMs, text }], updatedAt }
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;

  try {
    const job = await assertOwnerAndFinished(jobId);

    const srtText = await loadSubtitleText(jobId);
    const cues = parseSrt(srtText);

    // 화자 정보: SRT는 깨끗(라벨 없음)하므로 speakerId는 words.json에서 index로 매칭해 부착.
    // speaker_map(표시 이름)은 잡에 저장돼 있다. 둘 다 없으면 화자 미분리(평소 동작).
    const words = await getWordsJson<{ index?: number; speakerId?: string }[]>(jobId).catch(
      () => null,
    );
    if (Array.isArray(words)) {
      const byIndex = new Map(words.filter((w) => w?.speakerId).map((w) => [w.index, w.speakerId]));
      for (const c of cues as Cue[]) {
        const sid = byIndex.get(c.index);
        if (sid) c.speakerId = sid;
      }
    }

    return apiOk({
      jobId,
      language: job.language,
      cues,
      speakerMap: job.speakerMap ?? {},
      updatedAt: (job.finishedAt ?? job.createdAt).toISOString(),
    });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}

/**
 * PUT /api/subtitles/[jobId]
 *
 * 편집된 cues를 SRT로 재빌드하여 저장.
 */
const cueSchema = z.object({
  index: z.number().int().positive(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  text: z.string().min(1).max(200),
});

const putSchema = z.object({
  cues: z.array(cueSchema).min(1).max(10_000),
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const requestId = getRequestId(req);
  const { jobId } = await ctx.params;
  const log = logger.child({ requestId, route: 'subtitles/PUT', jobId });

  try {
    await assertOwnerAndFinished(jobId);
    const body = await req.json();
    const { cues: rawCues } = putSchema.parse(body);

    // HTML 태그 거부 (XSS 방어 — srt.ts와 동일 규칙)
    for (const c of rawCues) {
      if (/<[a-z]/i.test(c.text)) {
        throw new AppError('INVALID_INPUT', '자막에 HTML 태그는 허용되지 않습니다.', {
          index: c.index,
        });
      }
    }

    // 시간 정합성 검증
    const issues = validateCues(rawCues);
    if (issues.length > 0) {
      throw new AppError(
        'OVERLAP',
        `자막 시간이 겹치거나 잘못된 cue가 있습니다 (${issues.length}건).`,
        { issues: issues.slice(0, 10) },
      );
    }

    // 정규화 → SRT 빌드 → 저장
    const cues = normalizeCues(rawCues);
    const srtText = buildSrt(cues);
    await saveSubtitle({ jobId, srtText });
    log.info({ cueCount: cues.length, chars: srtText.length }, 'subtitle saved');

    return apiOk({ jobId, cueCount: cues.length, updatedAt: new Date().toISOString() });
  } catch (err) {
    return handleApiError(err, requestId);
  }
}

// ===== 공통 =====

async function assertOwnerAndFinished(jobId: string) {
  const owner = await getOwnerContext();
  const job = await getJobAdmin(jobId);
  if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');

  const isOwner =
    owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
  if (!isOwner) throw new AppError('FORBIDDEN', '권한이 없습니다.');

  if (!job.subtitleStorageKey) {
    throw new AppError('NOT_FOUND', '자막이 아직 생성되지 않았습니다.', {
      status: job.status,
    });
  }
  return job;
}
