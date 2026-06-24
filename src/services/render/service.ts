import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { CaptionAspect, CaptionStyle, Render, RenderOptions, RenderStatus } from '@/types/caption-style';
import type { Job } from '@/types/job';
import type { OwnerContext } from '@/types/session';
import { getOwnerContext } from '@/services/auth';
import { readIsPro } from '@/services/auth/user-profile';
import { getJobAdmin } from '@/services/jobs';
import { enqueueRender } from '@/services/queue';
import { presignRenderDownload, deleteRender } from '@/services/storage';
import { hasDoneTranslation } from '@/services/translation';
import { resolveRenderGating } from './gating';

/**
 * Render 서비스.
 *
 * 두 종류의 연산을 담는다:
 *   - 워커/시스템(admin): getRenderAdmin / 상태 전이(markRender*) / pending 픽업
 *   - 사용자(요청 스코프): createRender(게이팅·소유검증) / getRender(폴링)
 *
 * 상태 전이(Design §3.2): pending → rendering → (done|failed). 직접 done 금지.
 * 모든 쓰기는 service_role(admin) — renders RLS는 select(본인 잡)만 허용.
 * 게이팅(무료=워터마크+720 / Pro=제거+≤1080)은 ./gating + createRender에서 강제.
 */

type RenderRow = Database['public']['Tables']['renders']['Row'];

function mapRender(row: RenderRow): Render {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    status: row.status as RenderStatus,
    aspect: row.aspect as CaptionAspect,
    resolution: row.resolution,
    watermark: row.watermark,
    style: row.style as unknown as CaptionStyle,
    subtitleLang: row.subtitle_lang ?? 'ko',
    progressPercent: row.progress_percent ?? 0,
    outputStorageKey: row.output_storage_key,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    outputDeleteAt: row.output_delete_at ? new Date(row.output_delete_at) : null,
  };
}

/** 렌더 1건 로드 (RLS 우회). 없으면 null. */
export async function getRenderAdmin(renderId: string): Promise<Render | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('renders').select('*').eq('id', renderId).maybeSingle();
  if (error) throw new Error(`getRenderAdmin 실패: ${error.message}`);
  return data ? mapRender(data) : null;
}

/**
 * pending → rendering 전이. 동시 픽업 방지를 위해 status=pending 가드.
 * 이미 다른 워커가 가져갔으면 false.
 */
export async function markRenderRendering(renderId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('renders')
    .update({ status: 'rendering' })
    .eq('id', renderId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`markRenderRendering 실패: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * 렌더 진행률(%) 갱신. rendering 상태일 때만 기록(종료 상태 클로버 방지).
 * 워커가 ffmpeg 진행률로 자주 호출하므로 fire-and-forget(예외 무시)로 쓰는 게 안전.
 */
export async function updateRenderProgress(renderId: string, percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(99, Math.round(percent)));
  const admin = createAdminClient();
  const { error } = await admin
    .from('renders')
    .update({ progress_percent: clamped })
    .eq('id', renderId)
    .eq('status', 'rendering');
  if (error) throw new Error(`updateRenderProgress 실패: ${error.message}`);
}

/** rendering → done. 출력 키 + 자동삭제 예약 기록. */
export async function markRenderDone(params: {
  renderId: string;
  outputStorageKey: string;
  outputDeleteAt: Date | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('renders')
    .update({
      status: 'done',
      progress_percent: 100,
      output_storage_key: params.outputStorageKey,
      output_delete_at: params.outputDeleteAt ? params.outputDeleteAt.toISOString() : null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.renderId);
  if (error) throw new Error(`markRenderDone 실패: ${error.message}`);
}

/** → failed. 사유 기록. */
export async function markRenderFailed(params: {
  renderId: string;
  errorMessage: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('renders')
    .update({
      status: 'failed',
      error_message: params.errorMessage.slice(0, 1000),
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.renderId);
  if (error) throw new Error(`markRenderFailed 실패: ${error.message}`);
}

/** 가장 오래된 pending 렌더 id (poll-loop 픽업용). 없으면 null. */
export async function fetchOldestPendingRender(): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('renders')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`fetchOldestPendingRender 실패: ${error.message}`);
  return data?.[0]?.id ?? null;
}

// =========================================
// 사용자(요청 스코프) 연산 — createRender / getRender
// =========================================

/** 본인 잡 여부 검증. 회원=user_id 일치, 게스트=anonymousId 일치. */
function assertOwnsJob(job: Job, owner: OwnerContext): void {
  const owns =
    owner.kind === 'user'
      ? job.userId === owner.userId
      : job.ownerType === 'guest' && job.ownerId === owner.anonymousId;
  if (!owns) {
    throw new AppError('FORBIDDEN', '본인의 잡만 접근할 수 있습니다.');
  }
}

/**
 * 번인 렌더 생성 (사용자 요청).
 *   1. 소유 검증 + finished 잡 확인
 *   2. is_pro 게이팅 — 클라가 보낸 resolution/watermark 무시하고 재결정
 *   3. renders(pending) insert + 큐 인입(graceful)
 */
export async function createRender(
  jobId: string,
  opts: RenderOptions,
): Promise<{ renderId: string }> {
  const owner = await getOwnerContext();

  const job = await getJobAdmin(jobId);
  if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
  assertOwnsJob(job, owner);
  if (job.status !== 'finished') {
    throw new AppError(
      'INVALID_INPUT',
      '자막 생성이 완료된 잡만 번인 영상으로 내보낼 수 있습니다.',
    );
  }

  // 번인 언어 검증 — 'ko'(원본)가 아니면 해당 언어 번역이 완료(done) 상태여야 함.
  // (클라가 보낸 subtitleLang을 신뢰하지 않음 — Design §13 게이팅 우회 방지)
  const subtitleLang = opts.subtitleLang ?? 'ko';
  if (subtitleLang !== 'ko' && !(await hasDoneTranslation(jobId, subtitleLang))) {
    throw new AppError('INVALID_INPUT', '선택한 언어의 번역이 아직 완료되지 않았습니다.');
  }

  const isPro = owner.kind === 'user' ? await readIsPro(owner.userId) : false;
  const gated = resolveRenderGating(opts, isPro);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('renders')
    .insert({
      job_id: jobId,
      user_id: owner.kind === 'user' ? owner.userId : null,
      status: 'pending',
      aspect: opts.aspect,
      resolution: gated.resolution,
      watermark: gated.watermark,
      style: opts.style as unknown as Json,
      subtitle_lang: opts.subtitleLang ?? 'ko',
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new AppError('INTERNAL', `렌더 생성 실패: ${error?.message ?? 'unknown'}`);
  }

  await enqueueRender({ renderId: data.id });
  return { renderId: data.id };
}

export interface RenderView {
  status: RenderStatus;
  /** 0~100 (done이면 100) */
  progressPercent: number;
  /** status==='done'일 때만 출력 MP4 signed URL */
  downloadUrl: string | null;
  errorMessage: string | null;
}

/**
 * 렌더 상태 폴링 (사용자 요청). 본인 잡의 렌더만 조회.
 * done이면 출력 signed URL을 함께 발급한다.
 */
export async function getRender(renderId: string): Promise<RenderView> {
  const owner = await getOwnerContext();

  const render = await getRenderAdmin(renderId);
  if (!render) throw new AppError('NOT_FOUND', '렌더를 찾을 수 없습니다.');

  const job = await getJobAdmin(render.jobId);
  if (!job) throw new AppError('NOT_FOUND', '렌더의 원본 잡을 찾을 수 없습니다.');
  assertOwnsJob(job, owner);

  let downloadUrl: string | null = null;
  if (render.status === 'done' && render.outputStorageKey) {
    downloadUrl = await presignRenderDownload({
      storageKey: render.outputStorageKey,
      downloadName: buildOutputName(job.videoOriginalName),
    });
  }

  return {
    status: render.status,
    progressPercent: render.progressPercent,
    downloadUrl,
    errorMessage: render.errorMessage,
  };
}

/**
 * SSE 스트림용 렌더 스냅샷 (admin, RLS 우회). 소유 검증은 라우트에서 1회 수행 전제.
 * done이면 출력 signed URL 동봉. 렌더가 없으면 null.
 */
export async function getRenderStreamSnapshot(renderId: string): Promise<RenderView | null> {
  const render = await getRenderAdmin(renderId);
  if (!render) return null;

  let downloadUrl: string | null = null;
  if (render.status === 'done' && render.outputStorageKey) {
    const job = await getJobAdmin(render.jobId);
    downloadUrl = await presignRenderDownload({
      storageKey: render.outputStorageKey,
      downloadName: buildOutputName(job?.videoOriginalName ?? 'video'),
    });
  }
  return {
    status: render.status,
    progressPercent: render.progressPercent,
    downloadUrl,
    errorMessage: render.errorMessage,
  };
}

/** 원본 파일명에서 다운로드용 출력명 생성 (`name_subtitled.mp4`). */
function buildOutputName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video';
  return `${base}_subtitled.mp4`;
}

// =========================================
// 출력 자동삭제 (cleanup) — poll-loop이 주기적으로 호출
// =========================================

const RENDER_CLEANUP_BATCH = 20;

export interface RenderCleanupResult {
  scanned: number;
  deleted: number;
  errors: number;
}

/**
 * 만료된 렌더 출력(MP4) 일괄 삭제.
 *
 * 정책(Design §3.4 / worker/render.ts computeOutputDeleteAt):
 *   - 무료(게스트): output_delete_at = finished_at + 24시간
 *   - 회원:        output_delete_at = finished_at + 7일
 *
 * 동작: output_delete_at < now() AND output_storage_key not null인 렌더를 골라
 *   renders 버킷에서 파일 삭제 → output_storage_key를 null로(재처리 방지, 행은 보존).
 * jobs 비디오 청소(cleanupExpiredJobs)와 같은 폴링 틱에서 함께 호출.
 */
export async function cleanupExpiredRenders(): Promise<RenderCleanupResult> {
  const log = logger.child({ component: 'render-cleanup' });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('renders')
    .select('id, output_storage_key')
    .lt('output_delete_at', now)
    .not('output_storage_key', 'is', null)
    .limit(RENDER_CLEANUP_BATCH);

  if (error) {
    log.warn({ err: error.message }, 'render cleanup scan failed');
    return { scanned: 0, deleted: 0, errors: 1 };
  }

  const rows = data ?? [];
  if (rows.length === 0) return { scanned: 0, deleted: 0, errors: 0 };

  let deleted = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      if (row.output_storage_key) await deleteRender(row.output_storage_key);
      const { error: updErr } = await admin
        .from('renders')
        .update({ output_storage_key: null })
        .eq('id', row.id);
      if (updErr) throw new Error(updErr.message);
      deleted += 1;
      log.info({ renderId: row.id }, 'render output cleaned');
    } catch (err) {
      errors += 1;
      log.warn({ renderId: row.id, err: (err as Error)?.message }, 'render cleanup item failed');
    }
  }

  return { scanned: rows.length, deleted, errors };
}
