import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/supabase/database.types';
import type {
  Translation,
  TranslationOptions,
  TranslationStatus,
  TranslationView,
} from '@/types/translation';
import type { Job } from '@/types/job';
import type { OwnerContext } from '@/types/session';
import { getOwnerContext } from '@/services/auth';
import { readIsPro } from '@/services/auth/user-profile';
import { getJobAdmin } from '@/services/jobs';
import { createTranslationDownloadUrl, deleteTranslatedSubtitleByKey } from '@/services/storage';
import { isSupportedLang, SOURCE_LANG } from './languages';
import { assertTranslationAllowed } from './gating';

/**
 * Translation 서비스 (subtitle-translation) — renders 도메인 미러.
 *
 *   - 워커/시스템(admin): getTranslationAdmin / 상태 전이(markTranslation*) / pending 픽업
 *   - 사용자(요청 스코프): createTranslation(게이팅·소유검증) / getTranslation / list
 *
 * 상태 전이: pending → translating → (done|failed). 직접 done 금지.
 * 모든 쓰기는 service_role(admin). RLS는 select(본인 잡)만 허용.
 */

type TranslationRow = Database['public']['Tables']['translations']['Row'];

function mapTranslation(row: TranslationRow): Translation {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    status: row.status as TranslationStatus,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    engine: row.engine,
    outputStorageKey: row.output_storage_key,
    charCount: row.char_count,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    progressPercent: row.progress_percent ?? 0,
    createdAt: new Date(row.created_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    outputDeleteAt: row.output_delete_at ? new Date(row.output_delete_at) : null,
  };
}

/** 번역 1건 로드 (RLS 우회). 없으면 null. */
export async function getTranslationAdmin(translationId: string): Promise<Translation | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('translations')
    .select('*')
    .eq('id', translationId)
    .maybeSingle();
  if (error) throw new Error(`getTranslationAdmin 실패: ${error.message}`);
  return data ? mapTranslation(data) : null;
}

/** pending → translating 전이. 동시 픽업 방지(status=pending 가드). 이미 가져갔으면 false. */
export async function markTranslationTranslating(translationId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('translations')
    .update({ status: 'translating', started_at: new Date().toISOString(), progress_percent: 0 })
    .eq('id', translationId)
    .eq('status', 'pending')
    .select('id');
  if (error) throw new Error(`markTranslationTranslating 실패: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** 진행률(%) 갱신. translating 상태일 때만. fire-and-forget 권장. */
export async function updateTranslationProgress(translationId: string, percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(99, Math.round(percent)));
  const admin = createAdminClient();
  const { error } = await admin
    .from('translations')
    .update({ progress_percent: clamped })
    .eq('id', translationId)
    .eq('status', 'translating');
  if (error) throw new Error(`updateTranslationProgress 실패: ${error.message}`);
}

/** translating → done. 출력 키 + 문자수 + 자동삭제 예약 기록. */
export async function markTranslationDone(params: {
  translationId: string;
  outputStorageKey: string;
  charCount: number;
  outputDeleteAt: Date | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('translations')
    .update({
      status: 'done',
      progress_percent: 100,
      output_storage_key: params.outputStorageKey,
      char_count: params.charCount,
      output_delete_at: params.outputDeleteAt ? params.outputDeleteAt.toISOString() : null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.translationId);
  if (error) throw new Error(`markTranslationDone 실패: ${error.message}`);
}

/** → failed. 사유 기록. */
export async function markTranslationFailed(params: {
  translationId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('translations')
    .update({
      status: 'failed',
      error_code: params.errorCode,
      error_message: params.errorMessage.slice(0, 1000),
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.translationId);
  if (error) throw new Error(`markTranslationFailed 실패: ${error.message}`);
}

/** 해당 잡에 특정 언어의 완료(done) 번역 트랙이 존재하는지. 번인 언어 검증용. */
export async function hasDoneTranslation(jobId: string, targetLang: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('translations')
    .select('id')
    .eq('job_id', jobId)
    .eq('target_lang', targetLang)
    .eq('status', 'done')
    .limit(1);
  if (error) throw new Error(`hasDoneTranslation 실패: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** 가장 오래된 pending 번역 id (poll-loop 픽업용). 없으면 null. */
export async function fetchOldestPendingTranslation(): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('translations')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`fetchOldestPendingTranslation 실패: ${error.message}`);
  return data?.[0]?.id ?? null;
}

// =========================================
// 사용자(요청 스코프) 연산
// =========================================

/** 본인 잡 여부 검증 (renders와 동일). */
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
 * 번역 잡 생성 (사용자 요청).
 *   1. 소유 검증 + finished 잡 확인
 *   2. 지원 언어 검증 + 게이팅(무료 잡당 1언어)
 *   3. 같은 잡+언어가 있으면 idempotent(진행/완료 재사용, 실패는 pending 리셋)
 *   4. translations(pending) insert → poll-loop가 픽업(별도 큐 없음)
 */
export async function createTranslation(
  jobId: string,
  opts: TranslationOptions,
): Promise<{ translationId: string }> {
  if (!isSupportedLang(opts.targetLang)) {
    throw new AppError('INVALID_INPUT', `지원하지 않는 언어입니다: ${opts.targetLang}`);
  }

  const owner = await getOwnerContext();

  const job = await getJobAdmin(jobId);
  if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
  assertOwnsJob(job, owner);
  if (job.status !== 'finished') {
    throw new AppError('INVALID_INPUT', '자막 생성이 완료된 잡만 번역할 수 있습니다.');
  }

  const isPro = owner.kind === 'user' ? await readIsPro(owner.userId) : false;
  await assertTranslationAllowed({ jobId, targetLang: opts.targetLang, isPro });

  const admin = createAdminClient();

  // 같은 잡+언어 중복 처리 (unique index)
  const { data: existing } = await admin
    .from('translations')
    .select('id, status')
    .eq('job_id', jobId)
    .eq('target_lang', opts.targetLang)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'failed') {
      // 실패본 재시도 — pending으로 리셋
      const { error: rstErr } = await admin
        .from('translations')
        .update({
          status: 'pending',
          progress_percent: 0,
          error_code: null,
          error_message: null,
          started_at: null,
          finished_at: null,
          output_storage_key: null,
        })
        .eq('id', existing.id);
      if (rstErr) throw new AppError('INTERNAL', `번역 재시도 실패: ${rstErr.message}`);
    }
    return { translationId: existing.id };
  }

  const { data, error } = await admin
    .from('translations')
    .insert({
      job_id: jobId,
      user_id: owner.kind === 'user' ? owner.userId : null,
      status: 'pending',
      source_lang: SOURCE_LANG,
      target_lang: opts.targetLang,
      engine: 'deepl',
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new AppError('INTERNAL', `번역 생성 실패: ${error?.message ?? 'unknown'}`);
  }

  return { translationId: data.id };
}

async function toView(t: Translation, withDownload: boolean): Promise<TranslationView> {
  let downloadUrl: string | null = null;
  if (withDownload && t.status === 'done' && t.outputStorageKey) {
    downloadUrl = await createTranslationDownloadUrl({ jobId: t.jobId, lang: t.targetLang });
  }
  return {
    id: t.id,
    jobId: t.jobId,
    sourceLang: t.sourceLang,
    targetLang: t.targetLang,
    status: t.status,
    progressPercent: t.progressPercent,
    downloadUrl,
    errorCode: t.errorCode,
  };
}

/** 번역 상태 폴링 (사용자 요청). 본인 잡의 번역만. done이면 다운로드 URL 동봉. */
export async function getTranslation(translationId: string): Promise<TranslationView> {
  const owner = await getOwnerContext();
  const t = await getTranslationAdmin(translationId);
  if (!t) throw new AppError('NOT_FOUND', '번역을 찾을 수 없습니다.');

  const job = await getJobAdmin(t.jobId);
  if (!job) throw new AppError('NOT_FOUND', '번역의 원본 잡을 찾을 수 없습니다.');
  assertOwnsJob(job, owner);

  return toView(t, true);
}

/** 잡의 번역 트랙 목록 (편집기 언어 탭). 본인 잡만. */
export async function listTranslationsByJob(jobId: string): Promise<TranslationView[]> {
  const owner = await getOwnerContext();
  const job = await getJobAdmin(jobId);
  if (!job) throw new AppError('NOT_FOUND', '잡을 찾을 수 없습니다.');
  assertOwnsJob(job, owner);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('translations')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw new AppError('INTERNAL', `번역 목록 조회 실패: ${error.message}`);

  return Promise.all((data ?? []).map((row) => toView(mapTranslation(row), true)));
}

/** SSE 스트림용 스냅샷 (admin, RLS 우회). 소유 검증은 라우트에서 1회 전제. */
export async function getTranslationStreamSnapshot(
  translationId: string,
): Promise<TranslationView | null> {
  const t = await getTranslationAdmin(translationId);
  if (!t) return null;
  return toView(t, true);
}

// =========================================
// 출력 자동삭제 (cleanup) — poll-loop이 주기적으로 호출
// =========================================

const TRANSLATION_CLEANUP_BATCH = 20;

export interface TranslationCleanupResult {
  scanned: number;
  deleted: number;
  errors: number;
}

/**
 * 만료된 번역 자막(SRT) 일괄 삭제. renders cleanup 미러.
 * output_delete_at < now() AND output_storage_key not null → subtitles 버킷 삭제 + 키 null화.
 */
export async function cleanupExpiredTranslations(): Promise<TranslationCleanupResult> {
  const log = logger.child({ component: 'translation-cleanup' });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('translations')
    .select('id, output_storage_key')
    .lt('output_delete_at', now)
    .not('output_storage_key', 'is', null)
    .limit(TRANSLATION_CLEANUP_BATCH);

  if (error) {
    log.warn({ err: error.message }, 'translation cleanup scan failed');
    return { scanned: 0, deleted: 0, errors: 1 };
  }

  const rows = data ?? [];
  if (rows.length === 0) return { scanned: 0, deleted: 0, errors: 0 };

  let deleted = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      if (row.output_storage_key) await deleteTranslatedSubtitleByKey(row.output_storage_key);
      const { error: updErr } = await admin
        .from('translations')
        .update({ output_storage_key: null })
        .eq('id', row.id);
      if (updErr) throw new Error(updErr.message);
      deleted += 1;
      log.info({ translationId: row.id }, 'translation output cleaned');
    } catch (err) {
      errors += 1;
      log.warn({ translationId: row.id, err: (err as Error)?.message }, 'translation cleanup item failed');
    }
  }

  return { scanned: rows.length, deleted, errors };
}
