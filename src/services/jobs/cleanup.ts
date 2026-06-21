import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { deleteJobAssets } from '@/services/storage';
import { getJobAdmin } from '@/services/jobs';

/**
 * 만료된 잡 자산 일괄 청소.
 *
 * 정책 (Plan FR-17):
 *   - 게스트: video_delete_at = finished_at + 1시간 (번인 렌더용 최소 보관)
 *   - 회원: video_delete_at = finished_at + 30일
 *   - 진행 중(pending/rendering) 렌더가 있는 잡은 예정 시각이 지나도 영상 보존
 *
 * 워커 폴링이 매 사이클에 호출 (가벼움).
 *
 * 동작:
 *   1. video_delete_at < now() AND video_storage_key IS NOT NULL인 잡 N건 가져옴
 *   2. Storage 자산 (video + subtitle) 삭제
 *   3. jobs.video_storage_key를 NULL로 설정 — 다음 폴링에서 재처리 방지
 *
 * 자막 storage_key는 회원 다운로드 위해 유지.
 * 자막 자체 삭제는 별도 정책 필요 시 추가.
 */

const BATCH_SIZE = 20;

export interface CleanupResult {
  scanned: number;
  deletedVideos: number;
  errors: number;
}

export async function cleanupExpiredJobs(): Promise<CleanupResult> {
  const log = logger.child({ component: 'cleanup' });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 비디오 자산이 아직 있고 (storage_key not null), 삭제 예정 시각이 지난 잡들
  const { data, error } = await admin
    .from('jobs')
    .select('id, video_storage_key, video_original_name')
    .lt('video_delete_at', now)
    .not('video_storage_key', 'is', null)
    .limit(BATCH_SIZE);

  if (error) {
    log.warn({ err: error.message }, 'cleanup scan failed');
    return { scanned: 0, deletedVideos: 0, errors: 1 };
  }

  const candidates = data ?? [];
  if (candidates.length === 0) {
    return { scanned: 0, deletedVideos: 0, errors: 0 };
  }

  // 진행 중(pending/rendering) 번인 렌더가 있는 잡은 영상 보존 — 렌더에 원본이 필요.
  // (renders 테이블 미적용 등으로 실패해도 cleanup은 계속 — 보호만 생략)
  let protectedJobs = new Set<string>();
  try {
    const { data: active } = await admin
      .from('renders')
      .select('job_id')
      .in(
        'job_id',
        candidates.map((c) => c.id),
      )
      .in('status', ['pending', 'rendering']);
    protectedJobs = new Set((active ?? []).map((r) => r.job_id));
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'render 보호 조회 실패 (보호 없이 진행)');
  }

  log.info({ count: candidates.length, protected: protectedJobs.size }, 'cleanup candidates');

  let deleted = 0;
  let errors = 0;

  for (const row of candidates) {
    try {
      if (protectedJobs.has(row.id)) continue; // 진행 중 렌더 — 영상 보존
      const job = await getJobAdmin(row.id);
      if (!job) continue;
      // Storage 비디오만 삭제 (자막은 유지)
      await deleteJobAssets({ ...job, subtitleStorageKey: null });

      // video_storage_key를 비워서 재처리 방지 + 흔적은 남김
      const { error: updErr } = await admin
        .from('jobs')
        .update({ video_storage_key: '' })
        .eq('id', row.id);
      if (updErr) throw new Error(updErr.message);

      deleted += 1;
      log.info({ jobId: row.id }, 'video asset cleaned');
    } catch (err) {
      errors += 1;
      log.warn({ jobId: row.id, err: (err as Error)?.message }, 'cleanup item failed');
    }
  }

  return { scanned: candidates.length, deletedVideos: deleted, errors };
}

/**
 * 회원이 잡을 직접 삭제 (FR-16).
 * 잡 행 자체를 cascade로 제거 (job_events, share_links도 함께).
 * Storage 자산도 같이 제거.
 */
export async function deleteJobAndAssets(jobId: string): Promise<void> {
  const log = logger.child({ component: 'manual-delete', jobId });
  const admin = createAdminClient();

  const job = await getJobAdmin(jobId);
  if (!job) return;

  try {
    await deleteJobAssets(job);
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'storage delete failed (계속)');
  }

  const { error } = await admin.from('jobs').delete().eq('id', jobId);
  if (error) throw new Error(`잡 삭제 실패: ${error.message}`);
  log.info('job deleted');
}
