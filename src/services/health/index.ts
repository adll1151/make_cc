import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/api';

/**
 * DB 생존 확인 — `jobs`에 가장 가벼운 쿼리(head count, 행 미전송) 1회.
 *
 * 용도: Supabase 무료 티어는 일정 기간 요청이 없으면 프로젝트를 일시정지한다
 * (2026-10 실제 발생 → prod DB 경로 전부 실패). 주기 호출로 활동을 유지하고,
 * 동시에 "DB까지 실제로 닿는지"를 배포 검증에 쓴다.
 */
export async function pingDatabase(): Promise<{ dbLatencyMs: number }> {
  const t0 = Date.now();
  const { error } = await createAdminClient()
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .limit(1);
  if (error) throw new AppError('INTERNAL', `DB 응답 없음: ${error.message}`);
  return { dbLatencyMs: Date.now() - t0 };
}
