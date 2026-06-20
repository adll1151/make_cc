import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger, type Logger } from '@/lib/logger';
import { buildAss } from '@/lib/ass';
import { parseSrt } from '@/lib/srt';
import type { Cue, WordTiming } from '@/types/subtitle';
import { getJobAdmin } from '@/services/jobs';
import {
  getRenderAdmin,
  markRenderRendering,
  markRenderDone,
  markRenderFailed,
} from '@/services/render';
import { putRender, getWordsJson, getSubtitleText } from '@/services/storage';
import { videosBucket } from '@/lib/storage';
import { probeVideo, computeOutputDimensions, burnSubtitles } from './lib/ffmpeg';

/** 번들 OFL 폰트 디렉터리 (Pretendard/NotoSansKR). */
const FONTS_DIR = path.resolve(process.cwd(), 'worker/fonts');

/** 출력 보존: 회원 7일 / 무료(게스트) 24시간. */
function computeOutputDeleteAt(isUser: boolean): Date {
  const d = new Date();
  if (isUser) d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCHours(d.getUTCHours() + 24);
  return d;
}

/**
 * words.json → Cue[] 정규화. whisperX 산출물 포맷이 확정되기 전이라
 * 두 형태를 관용 수용: `Cue[]` 또는 `{ cues: Cue[] }`. 그 외/실패는 null.
 */
function normalizeWords(payload: unknown): Cue[] | null {
  const arr = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { cues?: unknown }).cues)
      ? (payload as { cues: unknown[] }).cues
      : null;
  if (!arr || arr.length === 0) return null;
  const cues: Cue[] = [];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i] as Record<string, unknown>;
    if (typeof c?.text !== 'string' || typeof c?.startMs !== 'number' || typeof c?.endMs !== 'number')
      return null;
    const words = Array.isArray(c.words)
      ? (c.words as Record<string, unknown>[])
          .filter(
            (w) =>
              typeof w?.text === 'string' &&
              typeof w?.startMs === 'number' &&
              typeof w?.endMs === 'number',
          )
          .map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs }) as WordTiming)
      : undefined;
    cues.push({ index: i + 1, startMs: c.startMs, endMs: c.endMs, text: c.text, words });
  }
  return cues;
}

/** 렌더용 cues 로드: words.json 우선(카라오케 가능) → 없으면 SRT 평문 fallback. */
async function loadCues(jobId: string, log: Logger): Promise<Cue[]> {
  const wordsPayload = await getWordsJson(jobId);
  const fromWords = wordsPayload ? normalizeWords(wordsPayload) : null;
  if (fromWords) {
    log.info({ cues: fromWords.length }, 'cues from words.json (karaoke 가능)');
    return fromWords;
  }
  const srt = await getSubtitleText(jobId);
  const cues = parseSrt(srt);
  log.info({ cues: cues.length }, 'cues from SRT (평문 fallback)');
  return cues;
}

export interface ProcessRenderResult {
  renderId: string;
  outputStorageKey: string;
  cueCount: number;
  width: number;
  height: number;
  elapsedSec: number;
}

/**
 * 번인 렌더 잡 처리 — 워커·CLI 양쪽이 호출.
 *
 * 단계 (Design §4.4):
 *   1. render + job 로드, pending→rendering 전이(동시픽업 가드)
 *   2. 영상 다운로드(임시 디렉터리)
 *   3. cues 로드 (words.json 우선 → SRT fallback)
 *   4. 출력 치수 산정(probe + aspect/resolution) → buildAss(PlayRes 일치)
 *   5. ffmpeg 번인(+crop +워터마크) → renders 버킷 업로드
 *   6. status=done + output_delete_at (실패 시 failed + 사유)
 */
export async function processRender(renderId: string): Promise<ProcessRenderResult> {
  const log = logger.child({ renderId, worker: 'render' });
  const start = Date.now();

  const render = await getRenderAdmin(renderId);
  if (!render) throw new Error(`render ${renderId} not found`);

  const job = await getJobAdmin(render.jobId);
  if (!job) throw new Error(`job ${render.jobId} (render ${renderId}) not found`);
  if (job.status !== 'finished') {
    throw new Error(`job ${render.jobId} not finished (status=${job.status}) — 자막 필요`);
  }

  // pending → rendering (다른 워커가 이미 가져갔으면 중단)
  const claimed = await markRenderRendering(renderId);
  if (!claimed) {
    log.warn('render already claimed/처리됨 — skip');
    throw new Error(`render ${renderId} not in pending state`);
  }

  log.info(
    { jobId: render.jobId, aspect: render.aspect, resolution: render.resolution, watermark: render.watermark },
    'start render',
  );

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcc-render-'));
  const videoPath = path.join(tmpDir, 'video' + path.extname(job.videoOriginalName));
  const assPath = path.join(tmpDir, 'subs.ass');
  const outPath = path.join(tmpDir, 'out.mp4');

  try {
    // 1. 영상 다운로드
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(videosBucket()).download(job.videoStorageKey);
    if (error || !data) throw new Error(`영상 다운로드 실패: ${error?.message ?? 'no data'}`);
    await fs.writeFile(videoPath, Buffer.from(await data.arrayBuffer()));
    log.info({ key: job.videoStorageKey }, 'video downloaded');

    // 2. cues 로드
    const cues = await loadCues(render.jobId, log);
    if (cues.length === 0) throw new Error('자막 cue가 없습니다 (SRT/words 비어있음).');

    // 3. 출력 치수 + ASS 빌드 (PlayRes = 출력 치수)
    const source = await probeVideo(videoPath);
    const output = computeOutputDimensions(render.aspect, render.resolution, source);
    const ass = buildAss(cues, render.style, { playResX: output.width, playResY: output.height });
    await fs.writeFile(assPath, ass, 'utf-8');
    log.info({ source, output, cues: cues.length }, 'ass built');

    // 4. 번인 렌더
    await burnSubtitles({
      inputPath: videoPath,
      assPath,
      outputPath: outPath,
      aspect: render.aspect,
      resolution: render.resolution,
      watermark: render.watermark,
      fontsDir: FONTS_DIR,
      output,
    });
    log.info('burn complete');

    // 5. 업로드 + 완료
    const buf = await fs.readFile(outPath);
    const { path: key } = await putRender({ renderId, body: buf });
    const deleteAt = computeOutputDeleteAt(job.ownerType === 'user');
    await markRenderDone({ renderId, outputStorageKey: key, outputDeleteAt: deleteAt });

    const elapsedSec = (Date.now() - start) / 1000;
    log.info({ key, bytes: buf.length, elapsedSec: elapsedSec.toFixed(1) }, 'render done');
    return {
      renderId,
      outputStorageKey: key,
      cueCount: cues.length,
      width: output.width,
      height: output.height,
      elapsedSec,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMessage }, 'render failed');
    try {
      await markRenderFailed({ renderId, errorMessage });
    } catch (markErr) {
      log.error({ markErr: (markErr as Error)?.message }, 'markRenderFailed 실패');
    }
    throw err;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
