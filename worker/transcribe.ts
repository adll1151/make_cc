import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { buildSrt } from '@/lib/srt';
import type { Cue } from '@/types/subtitle';
import {
  markStarted,
  updateProgress,
  markFinished,
  markFailed,
  getJobAdmin,
} from '@/services/jobs';
import { saveSubtitle, putWordsJson } from '@/services/storage';
import { videosBucket } from '@/lib/storage';
import { dispatchJobCompleted, dispatchJobFailed } from '@/services/notify';
import { extractAudio } from './lib/ffmpeg';
import { runWhisper } from './lib/whisper';

/**
 * 잡 한 건의 STT 파이프라인 — 워커·CLI 양쪽이 호출.
 *
 * 단계:
 *   1. 잡 로드 (RLS 우회 admin)
 *   2. 상태 전이: queued|uploading → transcribing (started_at 기록)
 *   3. 영상 다운로드 (Supabase Storage → 임시 디렉터리)
 *   4. ffmpeg로 16kHz wav 추출
 *   5. faster-whisper Python 스크립트 spawn → 세그먼트 스트리밍 수신
 *   6. progress 5% 단위 update
 *   7. cues 누적 → SRT 빌드 → Storage 업로드
 *   8. 잡 finished + subtitleStorageKey 기록
 *   9. 임시 파일 정리
 *
 * 실패 시 markFailed로 상태 갱신 후 throw (호출자가 큐 재시도 결정).
 */
export async function processTranscribe(jobId: string): Promise<{
  cueCount: number;
  subtitleStorageKey: string;
  elapsedSec: number;
  whisperElapsedSec: number;
}> {
  const log = logger.child({ jobId, worker: 'transcribe' });
  const totalStart = Date.now();

  const job = await getJobAdmin(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);

  log.info(
    {
      ownerType: job.ownerType,
      durationSec: job.videoDurationSec,
      sizeBytes: job.videoSizeBytes,
      status: job.status,
    },
    'start transcribe',
  );

  // 상태 머신: queued → transcribing만 허용 (Design §3.1)
  if (job.status === 'uploading') {
    // module-5 complete 미구현 환경에서 임시로 직접 queued로 전이
    log.warn('job is uploading — auto-transition to queued (PoC)');
    await transitionToQueued(jobId);
  }

  await markStarted(jobId);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcc-stt-'));
  const videoPath = path.join(tmpDir, 'video' + path.extname(job.videoOriginalName));
  const audioPath = path.join(tmpDir, 'audio.wav');

  try {
    // 1. 영상 다운로드
    log.info({ key: job.videoStorageKey }, 'downloading video');
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(videosBucket())
      .download(job.videoStorageKey);
    if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no data'}`);
    const buf = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(videoPath, buf);
    log.info({ bytes: buf.length }, 'video downloaded');
    await updateProgress(jobId, 8);

    // 2. 음성 추출
    log.info('extracting audio');
    await extractAudio(videoPath, audioPath);
    log.info('audio extracted');
    await updateProgress(jobId, 18);

    // 3. Whisper STT (스트리밍)
    const modelName = process.env.WHISPER_MODEL ?? 'small';
    const device = (process.env.WHISPER_DEVICE as 'auto' | 'cuda' | 'cpu') ?? 'auto';
    log.info({ model: modelName, device }, 'running whisper');

    const cues: Cue[] = [];
    let nextProgressTarget = 25;
    const PROGRESS_FLOOR = 25;
    const PROGRESS_CEIL = 90;
    const durationSec = job.videoDurationSec;

    const whisperResult = await runWhisper(audioPath, {
      model: modelName,
      language: 'ko',
      device,
      onInfo: (msg) => log.info({ whisper: msg }, 'whisper info'),
      onSegment: (seg) => {
        const words = seg.words?.map((w) => ({
          text: w.text,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        }));
        cues.push({
          index: cues.length + 1,
          startMs: Math.round(seg.start * 1000),
          endMs: Math.round(seg.end * 1000),
          text: seg.text,
          ...(words && words.length > 0 ? { words } : {}),
        });
        // 진행률은 5% 단위 throttle (Design §11.3 cue 처리 정책)
        const ratio = Math.min(1, seg.end / Math.max(1, durationSec));
        const target = PROGRESS_FLOOR + Math.round(ratio * (PROGRESS_CEIL - PROGRESS_FLOOR));
        if (target >= nextProgressTarget) {
          // fire-and-forget (await하면 STT 스트림 블록)
          updateProgress(jobId, Math.min(PROGRESS_CEIL, target)).catch((err) =>
            log.warn({ err }, 'progress update failed'),
          );
          nextProgressTarget = target + 5;
        }
      },
    });
    log.info(
      {
        cueCount: cues.length,
        whisperSec: whisperResult.elapsedSec.toFixed(1),
        durationSec: whisperResult.duration.toFixed(1),
      },
      'whisper complete',
    );
    await updateProgress(jobId, 92);

    if (cues.length === 0) {
      throw new Error('Whisper가 음성을 인식하지 못했습니다 (cues = 0).');
    }

    // 4. SRT 빌드 + 업로드
    log.info('building srt');
    const srtText = buildSrt(cues);
    log.info({ chars: srtText.length }, 'uploading srt');
    const { path: subtitleKey } = await saveSubtitle({ jobId, srtText });

    // 4b. 단어 타이밍 저장 (있을 때만) — 번인 카라오케 하이라이트용.
    //     render 워커가 {jobId}.words.json을 우선 로드해 카라오케 활성화.
    const wordCueCount = cues.filter((c) => c.words && c.words.length > 0).length;
    if (wordCueCount > 0) {
      try {
        await putWordsJson(jobId, cues);
        log.info({ wordCues: wordCueCount, totalCues: cues.length }, 'words.json saved (카라오케 가능)');
      } catch (err) {
        // 단어 타이밍 저장 실패는 비치명적 — SRT 평문 fallback으로 렌더 가능
        log.warn({ err: (err as Error)?.message }, 'words.json 저장 실패 (평문 fallback 유지)');
      }
    } else {
      log.info('단어 타이밍 없음 — words.json 생략 (평문 렌더)');
    }

    // 5. 잡 완료 + 자동 삭제 예약 (Plan FR-17)
    //    게스트: 1시간 후 — 번인 영상 내보내기에 원본이 필요해서 즉시삭제하면 렌더가
    //            영상을 못 찾음. 이 짧은 보존 동안 렌더 가능. (진행 중 렌더는 cleanup이 보존)
    //    회원: 30일 후
    const deleteAt = new Date();
    if (job.ownerType === 'user') {
      deleteAt.setUTCDate(deleteAt.getUTCDate() + 30);
    } else {
      deleteAt.setUTCHours(deleteAt.getUTCHours() + 1);
    }
    // transitionStatus로 video_delete_at도 함께 갱신
    await markFinished({ jobId, subtitleStorageKey: subtitleKey });
    await scheduleVideoDeletion(jobId, deleteAt);

    const elapsedSec = (Date.now() - totalStart) / 1000;
    log.info(
      {
        cueCount: cues.length,
        subtitleStorageKey: subtitleKey,
        elapsedSec: elapsedSec.toFixed(1),
      },
      'transcribe done',
    );

    // 6. 완료 알림 디스패치 (notify_channel 기준 Email/Discord/both, 멱등 가드 내장)
    dispatchJobCompleted({
      jobId,
      ownerType: job.ownerType,
      userId: job.userId,
      videoOriginalName: job.videoOriginalName,
      videoDurationSec: job.videoDurationSec,
      cueCount: cues.length,
    }).catch((err) => log.warn({ err: (err as Error)?.message }, 'notify completed failed'));

    return {
      cueCount: cues.length,
      subtitleStorageKey: subtitleKey,
      elapsedSec,
      whisperElapsedSec: whisperResult.elapsedSec,
    };
  } catch (err) {
    log.error({ err }, 'transcribe failed');
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await markFailed({
        jobId,
        errorCode: 'STT_FAILED',
        errorMessage,
      });
    } catch (markErr) {
      log.error({ markErr }, 'markFailed 실패 (잡 상태 이미 종료된 듯)');
    }
    // 실패 알림도 fire-and-forget (notify_channel 기준 디스패치)
    dispatchJobFailed({
      jobId,
      ownerType: job.ownerType,
      userId: job.userId,
      videoOriginalName: job.videoOriginalName,
      videoDurationSec: job.videoDurationSec,
      errorMessage,
    }).catch((notifyErr) =>
      log.warn({ err: (notifyErr as Error)?.message }, 'notify failed (failed job)'),
    );
    throw err;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 임시: uploading → queued 직접 전이 (module-5 /complete 라우트 부재 시 PoC용).
 */
async function transitionToQueued(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('jobs')
    .update({ status: 'queued' })
    .eq('id', jobId)
    .eq('status', 'uploading');
  if (error) throw new Error(`uploading→queued 전이 실패: ${error.message}`);
}

/** finished 잡에 video_delete_at 설정 — cleanup이 활용 */
async function scheduleVideoDeletion(jobId: string, deleteAt: Date): Promise<void> {
  const admin = createAdminClient();
  await admin.from('jobs').update({ video_delete_at: deleteAt.toISOString() }).eq('id', jobId);
}
