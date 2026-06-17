import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 게스트 글로벌 일일 캡 카운터 (daily_guest_usage).
 *
 * 게스트 잡이 큐잉되는 시점에 `incrementGuestDaily()`로 누적,
 * `getGuestDailyUsage()`로 사전 검증.
 *
 * service_role 사용 — RLS 우회.
 * 회원 1인당 캡(분량/파일크기)은 별도 카운터 없이 캡 가드(guards.ts)에서 즉시 판단.
 */

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface GuestDailyUsage {
  date: string;
  totalJobs: number;
  totalDurationSec: number;
}

export async function getGuestDailyUsage(date: string = todayUtc()): Promise<GuestDailyUsage> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('daily_guest_usage')
    .select('date, total_jobs, total_duration_sec')
    .eq('date', date)
    .maybeSingle();

  if (error) {
    throw new Error(`게스트 일일 캡 조회 실패: ${error.message}`);
  }

  return {
    date,
    totalJobs: data?.total_jobs ?? 0,
    totalDurationSec: data?.total_duration_sec ?? 0,
  };
}

export async function incrementGuestDaily(params: {
  date?: string;
  durationSec: number;
}): Promise<GuestDailyUsage> {
  const date = params.date ?? todayUtc();
  const admin = createAdminClient();

  // upsert + RPC가 아닌 read-then-write로 처리.
  // 동시성 우려는 캡 자체가 soft limit이라 허용.
  // 엄밀한 원자성 필요 시 SQL function 또는 advisory lock 도입.
  const current = await getGuestDailyUsage(date);
  const next = {
    date,
    total_jobs: current.totalJobs + 1,
    total_duration_sec: current.totalDurationSec + params.durationSec,
  };

  const { error } = await admin.from('daily_guest_usage').upsert(next, { onConflict: 'date' });
  if (error) throw new Error(`게스트 일일 캡 갱신 실패: ${error.message}`);

  return {
    date,
    totalJobs: next.total_jobs,
    totalDurationSec: next.total_duration_sec,
  };
}
