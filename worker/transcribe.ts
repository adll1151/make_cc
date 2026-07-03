import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { buildSrt } from '@/lib/srt';
import type { Cue, SpeakerMap } from '@/types/subtitle';
import { splitCue } from './lib/cue-split';
import {
  markStarted,
  updateProgress,
  markFinished,
  markFailed,
  getJobAdmin,
  updateSpeakerMap,
} from '@/services/jobs';
import { saveSubtitle, putWordsJson } from '@/services/storage';
import { videosBucket } from '@/lib/storage';
import { dispatchJobCompleted, dispatchJobFailed } from '@/services/notify';
import { extractAudio } from './lib/ffmpeg';
import { runWhisper } from './lib/whisper';
import { runSoundEvents, eventsToSoundCues, type RawSoundEvent } from './lib/sound-events';

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

    // 2b. 리치 CC — 오디오 이벤트 감지를 CPU에서 Whisper(GPU)와 **병렬** 시작.
    //     베스트에포트: 실패해도 [] 반환(STT 무영향). 결과는 SRT 빌드 전에 await.
    const soundEventsPromise: Promise<RawSoundEvent[]> = runSoundEvents(audioPath, {
      device: 'cpu',
      // 오디오 길이에 비례한 타임아웃(초당 0.8s, 최소 60s) — 행 방지, 베스트에포트.
      timeoutMs: Math.max(60_000, Math.round((job.videoDurationSec ?? 60) * 800)),
      onInfo: (msg) => log.info({ soundEvents: msg }, 'sound-events info'),
    });

    // 3. Whisper STT (스트리밍)
    const modelName = process.env.WHISPER_MODEL ?? 'small';
    const device = (process.env.WHISPER_DEVICE as 'auto' | 'cuda' | 'cpu') ?? 'auto';
    // 화자 분리: 잡 설정 + 전역 env 둘 다 허용일 때. (HF 토큰 없으면 whisperx가 STT로 graceful degrade)
    const diarize = job.diarizationEnabled && (process.env.WHISPER_DIARIZATION ?? 'true') !== 'false';
    log.info({ model: modelName, device, diarize }, 'running whisper');

    const cues: Cue[] = [];
    let nextProgressTarget = 25;
    const PROGRESS_FLOOR = 25;
    const PROGRESS_CEIL = 90;
    const durationSec = job.videoDurationSec;

    const whisperResult = await runWhisper(audioPath, {
      model: modelName,
      language: 'ko',
      device,
      diarize,
      onInfo: (msg) => log.info({ whisper: msg }, 'whisper info'),
      onSegment: (seg) => {
        const words = seg.words?.map((w) => ({
          text: w.text,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        }));
        // 긴 세그먼트는 문장/길이/시간 기준으로 여러 cue로 분할(가독성)
        const parts = splitCue({
          startMs: Math.round(seg.start * 1000),
          endMs: Math.round(seg.end * 1000),
          text: seg.text,
          ...(words && words.length > 0 ? { words } : {}),
          ...(seg.speaker ? { speakerId: seg.speaker } : {}),
        });
        for (const part of parts) {
          cues.push({ index: cues.length + 1, ...part });
        }
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

    // 3c. 리치 CC — 사운드 이벤트 → CC 큐 → 대사 큐와 타임라인 병합 (베스트에포트).
    //     대사 0개여도 사운드 이벤트(음악/웃음)만으로 자막을 낼 수 있으므로 cues 검사 전에 병합.
    let soundCues: Cue[] = [];
    try {
      const rawEvents = await soundEventsPromise;
      soundCues = eventsToSoundCues(rawEvents);
      log.info({ rawEvents: rawEvents.length, soundCues: soundCues.length }, 'sound events → CC 큐');
    } catch (err) {
      log.warn({ err: (err as Error)?.message }, 'sound events 처리 실패 (CC 사운드 생략)');
    }
    const allCues = mergeCuesByTime(cues, soundCues);

    if (allCues.length === 0) {
      throw new Error('음성·오디오 이벤트를 인식하지 못했습니다 (cues = 0).');
    }

    // 3b. 화자 맵 생성·저장 (diarization 결과) — spk_0 → '화자 1' ... 편집기 표시명/이름변경용.
    //     SRT 본문엔 라벨을 넣지 않음(번인 오염 방지). speaker 정보는 cue.speakerId(words.json)
    //     + jobs.speaker_map에 보존. 화자 1명(또는 미분리)이면 맵 비움.
    const speakerIds = [
      ...new Set(cues.map((c) => c.speakerId).filter((s): s is string => !!s)),
    ].sort();
    if (speakerIds.length > 1) {
      const speakerMap: SpeakerMap = Object.fromEntries(
        speakerIds.map((id, i) => [id, `화자 ${i + 1}`]),
      );
      try {
        await updateSpeakerMap(jobId, speakerMap);
        log.info({ speakers: speakerIds.length }, 'speaker_map saved (화자 분리)');
      } catch (err) {
        log.warn({ err: (err as Error)?.message }, 'speaker_map 저장 실패 (비치명적)');
      }
    } else {
      log.info({ speakers: speakerIds.length }, '단일/미분리 화자 — speaker_map 생략');
    }

    // 4. SRT 빌드 + 업로드 (대사 + CC 사운드 큐)
    log.info('building srt');
    const srtText = buildSrt(allCues);
    log.info({ chars: srtText.length }, 'uploading srt');
    const { path: subtitleKey } = await saveSubtitle({ jobId, srtText });

    // 4b. 단어 타이밍 저장 (있을 때만) — 번인 카라오케 하이라이트용.
    //     render 워커가 {jobId}.words.json을 우선 로드해 카라오케 활성화.
    const wordCueCount = allCues.filter((c) => c.words && c.words.length > 0).length;
    if (wordCueCount > 0) {
      try {
        await putWordsJson(jobId, allCues);
        log.info({ wordCues: wordCueCount, totalCues: allCues.length }, 'words.json saved (카라오케 가능)');
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
        cueCount: allCues.length,
        speechCues: cues.length,
        soundCues: soundCues.length,
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
      cueCount: allCues.length,
    }).catch((err) => log.warn({ err: (err as Error)?.message }, 'notify completed failed'));

    return {
      cueCount: allCues.length,
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
 * 대사 큐(speech) + CC 사운드 큐(sound)를 시작 시각 기준 병합·재인덱싱.
 * 같은 시각이면 대사(speech) 먼저, 그다음 종료 시각 순. sound 큐 없으면 원본 그대로.
 */
function mergeCuesByTime(speech: Cue[], sound: Cue[]): Cue[] {
  if (sound.length === 0) return speech;
  const kindRank = (c: Cue) => (c.kind === 'sound' ? 1 : 0);
  const all = [...speech, ...sound].sort(
    (a, b) => a.startMs - b.startMs || kindRank(a) - kindRank(b) || a.endMs - b.endMs,
  );
  return all.map((c, i) => ({ ...c, index: i + 1 }));
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
