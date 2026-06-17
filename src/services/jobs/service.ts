import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { AppError } from '@/lib/api';
import type { CreateJobInput, Job, JobStatus } from '@/types/job';
import type { Database } from '@/lib/supabase/database.types';
import { assertTransition, isTerminal } from './state-machine';
import { appendJobEvent } from './events';
import { incrementGuestDaily } from '@/services/auth/quotas';

type JobUpdate = Database['public']['Tables']['jobs']['Update'];
type JobRow = Database['public']['Tables']['jobs']['Row'];

/**
 * 잡 도메인 서비스.
 *
 * 책임:
 *   - 잡 생성·조회·이력
 *   - 상태 전이 (state-machine 강제)
 *   - 자동 이벤트 기록 (uploaded/queued/started/progress/finished/failed/cancelled)
 *   - 게스트 일일 카운터 증가 (queued 전이 시)
 *
 * 권한:
 *   - 회원 잡 조회: RLS로 자기 잡만 (serverSupabase)
 *   - 잡 생성·상태 변경: admin (RLS 우회 — 게스트도 생성 가능, 워커도 호출)
 */

// =========================================
// CREATE
// =========================================

export async function createJob(input: CreateJobInput): Promise<Job> {
  const admin = createAdminClient();

  const insert: Database['public']['Tables']['jobs']['Insert'] = {
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    user_id: input.userId,
    status: 'pending',
    video_original_name: input.videoOriginalName,
    video_size_bytes: input.videoSizeBytes,
    video_duration_sec: input.videoDurationSec,
    video_storage_key: input.videoStorageKey,
    language: 'ko',
  };
  if (input.id) insert.id = input.id;

  const { data, error } = await admin
    .from('jobs')
    .insert(insert)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`잡 생성 실패: ${error?.message ?? 'unknown'}`);
  }
  return rowToJob(data);
}

// =========================================
// READ
// =========================================

export async function getJobAdmin(jobId: string): Promise<Job | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(`잡 조회 실패: ${error.message}`);
  return data ? rowToJob(data) : null;
}

export async function listMyJobs(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<Job[]> {
  // RLS가 user_id = auth.uid()로 자동 필터
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 20) - 1);
  if (error) throw new Error(`내 잡 이력 조회 실패: ${error.message}`);
  return (data ?? []).map(rowToJob);
}

// =========================================
// TRANSITIONS
// =========================================

/** 일반 상태 전이 (내부용) */
export async function transitionStatus(
  jobId: string,
  to: JobStatus,
  patch?: Partial<{
    progressPercent: number;
    queuePosition: number | null;
    subtitleStorageKey: string;
    errorCode: string;
    errorMessage: string;
    startedAt: Date;
    finishedAt: Date;
    videoDeleteAt: Date;
  }>,
): Promise<Job> {
  const admin = createAdminClient();
  const current = await getJobAdmin(jobId);
  if (!current) {
    throw new AppError('NOT_FOUND', `잡을 찾을 수 없습니다 (id=${jobId})`);
  }
  assertTransition(current.status, to);

  const updates: JobUpdate = { status: to };
  if (patch?.progressPercent !== undefined) updates.progress_percent = patch.progressPercent;
  if (patch?.queuePosition !== undefined) updates.queue_position = patch.queuePosition;
  if (patch?.subtitleStorageKey !== undefined)
    updates.subtitle_storage_key = patch.subtitleStorageKey;
  if (patch?.errorCode !== undefined) updates.error_code = patch.errorCode;
  if (patch?.errorMessage !== undefined) updates.error_message = patch.errorMessage;
  if (patch?.startedAt) updates.started_at = patch.startedAt.toISOString();
  if (patch?.finishedAt) updates.finished_at = patch.finishedAt.toISOString();
  if (patch?.videoDeleteAt) updates.video_delete_at = patch.videoDeleteAt.toISOString();

  const { data, error } = await admin
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`잡 상태 전이 실패 (${current.status}→${to}): ${error?.message ?? 'unknown'}`);
  }
  return rowToJob(data);
}

// =========================================
// 고수준 전이 (events 자동 기록)
// =========================================

/** 업로드 시작 표시: pending → uploading */
export async function markUploading(jobId: string): Promise<Job> {
  const job = await transitionStatus(jobId, 'uploading');
  return job;
}

/**
 * 업로드 완료 → 큐잉.
 * uploading → queued.
 * 게스트면 일일 카운터 증가.
 */
export async function markUploaded(jobId: string): Promise<Job> {
  const job = await transitionStatus(jobId, 'queued');
  await appendJobEvent({ jobId, type: 'uploaded' });
  await appendJobEvent({ jobId, type: 'queued' });
  if (job.ownerType === 'guest') {
    await incrementGuestDaily({ durationSec: job.videoDurationSec });
  }
  return job;
}

/** 워커가 처리 시작: queued → transcribing */
export async function markStarted(jobId: string): Promise<Job> {
  const job = await transitionStatus(jobId, 'transcribing', { startedAt: new Date() });
  await appendJobEvent({ jobId, type: 'started' });
  return job;
}

/**
 * 워커 진행률 업데이트 (5% 단위 throttle은 호출자 책임).
 * 상태 전이 없음 — progress_percent만 변경.
 */
export async function updateProgress(jobId: string, percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const admin = createAdminClient();
  const { error } = await admin
    .from('jobs')
    .update({ progress_percent: clamped })
    .eq('id', jobId);
  if (error) throw new Error(`진행률 갱신 실패: ${error.message}`);
  await appendJobEvent({ jobId, type: 'progress', payload: { percent: clamped } });
}

/** 처리 완료 + 자막 키 저장: transcribing → finished */
export async function markFinished(params: {
  jobId: string;
  subtitleStorageKey: string;
}): Promise<Job> {
  const job = await transitionStatus(params.jobId, 'finished', {
    subtitleStorageKey: params.subtitleStorageKey,
    progressPercent: 100,
    finishedAt: new Date(),
  });
  await appendJobEvent({
    jobId: params.jobId,
    type: 'finished',
    payload: { subtitleStorageKey: params.subtitleStorageKey },
  });
  return job;
}

/** 실패 처리. 어느 비종결 상태에서든 호출 가능. */
export async function markFailed(params: {
  jobId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<Job> {
  const job = await transitionStatus(params.jobId, 'failed', {
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    finishedAt: new Date(),
  });
  await appendJobEvent({
    jobId: params.jobId,
    type: 'failed',
    payload: { errorCode: params.errorCode, errorMessage: params.errorMessage },
  });
  return job;
}

/** 사용자 취소: 비종결 상태에서만 가능. */
export async function cancelJob(jobId: string): Promise<Job> {
  const current = await getJobAdmin(jobId);
  if (!current) {
    throw new AppError('NOT_FOUND', `잡을 찾을 수 없습니다 (id=${jobId})`);
  }
  if (isTerminal(current.status)) {
    throw new AppError(
      'FORBIDDEN',
      `이미 종료된 잡은 취소할 수 없습니다 (status=${current.status})`,
    );
  }
  const job = await transitionStatus(jobId, 'cancelled', { finishedAt: new Date() });
  await appendJobEvent({ jobId, type: 'cancelled' });
  return job;
}

// =========================================
// row → domain
// =========================================

function rowToJob(row: JobRow): Job {
  const rawSpeakerMap =
    (row as JobRow & { speaker_map?: unknown }).speaker_map ?? {};
  const speakerMap =
    rawSpeakerMap && typeof rawSpeakerMap === 'object' && !Array.isArray(rawSpeakerMap)
      ? (rawSpeakerMap as Record<string, string>)
      : {};

  const diarizationEnabled =
    (row as JobRow & { diarization_enabled?: boolean }).diarization_enabled ?? true;

  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    userId: row.user_id,
    status: row.status,
    progressPercent: row.progress_percent,
    queuePosition: row.queue_position,
    videoOriginalName: row.video_original_name,
    videoSizeBytes: Number(row.video_size_bytes),
    videoDurationSec: row.video_duration_sec,
    videoStorageKey: row.video_storage_key,
    subtitleStorageKey: row.subtitle_storage_key,
    language: 'ko',
    errorCode: row.error_code,
    errorMessage: row.error_message,
    speakerMap,
    diarizationEnabled,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    videoDeleteAt: row.video_delete_at ? new Date(row.video_delete_at) : null,
  };
}

// =========================================
// Speaker Map (module-1: speaker-diarization)
// =========================================

import type { SpeakerMap } from '@/types/subtitle';

/** 잡의 화자 맵 갱신 — 워커·편집기 양쪽이 호출 */
export async function updateSpeakerMap(
  jobId: string,
  speakerMap: SpeakerMap,
): Promise<void> {
  const admin = createAdminClient();
  // JSONB는 unknown으로 캐스팅하여 update 타입 회피 (generated types가 jsonb를 정확히 모름)
  const { error } = await admin
    .from('jobs')
    .update({ speaker_map: speakerMap } as unknown as Database['public']['Tables']['jobs']['Update'])
    .eq('id', jobId);
  if (error) throw new Error(`speaker_map 갱신 실패: ${error.message}`);
}

export async function getSpeakerMap(jobId: string): Promise<SpeakerMap> {
  const job = await getJobAdmin(jobId);
  return job?.speakerMap ?? {};
}
