import { createAdminClient } from '@/lib/supabase/admin';
import type { JobEventType } from '@/types/job';
import type { Json } from '@/lib/supabase/database.types';

/**
 * 잡 이벤트 (append-only 감사 로그).
 *
 * 정책 (사용자 결정): 모든 전이 + progress도 기록.
 * progress는 호출자가 5% 단위 등으로 throttle 권장.
 */
export async function appendJobEvent(params: {
  jobId: string;
  type: JobEventType;
  payload?: Record<string, Json>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('job_events').insert({
    job_id: params.jobId,
    type: params.type,
    payload: (params.payload ?? {}) as Json,
  });
  if (error) {
    throw new Error(`job_events 기록 실패 (job=${params.jobId}, type=${params.type}): ${error.message}`);
  }
}

/**
 * 특정 타입 이벤트 존재 여부 (멱등 가드용).
 * 조회 실패 시 false 반환 — 알림 누락(false→재발송)이 중복보다 덜 나쁨.
 */
export async function hasJobEvent(jobId: string, type: JobEventType): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('job_events')
    .select('id')
    .eq('job_id', jobId)
    .eq('type', type)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
