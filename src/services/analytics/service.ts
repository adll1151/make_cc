import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import type { Json } from '@/lib/supabase/database.types';
import type { OwnerContext } from '@/types/session';
import type { AnalyticsBatch } from '@/types/analytics';

/**
 * 퍼널 이벤트 적재 (append-only).
 *
 * - 신원: 회원=user_id, 게스트=anon_id(mcc_anon 쿠키). 둘 다 서버에서 결정(클라 위조 방지).
 * - 분석은 부가 기능 → insert 실패해도 throw하지 않고 로그만 남긴다(사용자 흐름 보호).
 * - service_role(admin)로 insert. RLS는 조회를 완전 차단(운영자 전용).
 */
export async function recordAnalyticsEvents(params: {
  batch: AnalyticsBatch;
  owner: OwnerContext | null;
  userAgent?: string | null;
}): Promise<void> {
  const { batch, owner, userAgent } = params;
  const anonId = owner?.kind === 'guest' ? owner.anonymousId : null;
  const userId = owner?.kind === 'user' ? owner.userId : null;

  const rows = batch.events.map((e) => ({
    event: e.event,
    path: e.path ?? null,
    job_id: e.jobId ?? null,
    properties: (e.properties ?? {}) as Json,
    session_id: batch.sessionId,
    anon_id: anonId,
    user_id: userId,
    referrer: batch.referrer ?? null,
    user_agent: userAgent ?? null,
  }));

  const admin = createAdminClient();
  const { error } = await admin.from('analytics_events').insert(rows);
  if (error) {
    logger.warn({ err: error, count: rows.length }, 'analytics insert 실패');
  }
}
