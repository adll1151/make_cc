import { createAdminClient } from '@/lib/supabase/admin';
import { getWorkerHeartbeatTs } from '@/lib/storage';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * 워커 다운 시 운영자 알림 (Discord 웹훅).
 *
 * 셀프호스팅 폴링 워커(worker:poll)가 PC에서만 돌아 항상 떠 있지 않은 환경을 위해,
 * 잡이 queued 됐는데 워커가 최근에 활동한 흔적이 없으면 "워커 켜주세요" 알림을 1회 보낸다.
 *
 * 설계:
 *   - 생존 판정: 워커(poll-loop)가 Storage에 주기적으로 쓰는 하트비트가 신선하면(HEARTBEAT_FRESH
 *     이내) 살아있다고 보고 알림 생략. idle 워커도 하트비트는 갱신하므로 오탐 없음.
 *   - 버스트 중복 제거: 이 잡 외에 DEDUP_WINDOW 안에 만들어진 'queued' 잡이 또 있으면
 *     이미 먼저 알림이 나갔다고 보고 생략(다운 상태에서 잡이 몰려도 알림은 1회).
 *
 * 절대 throw하지 않음 — 알림 실패가 업로드 응답 흐름을 막지 않는다.
 */

// 워커는 ~15s마다 하트비트를 쓴다. 3배 여유(45s) 안이면 살아있다고 본다.
const HEARTBEAT_FRESH_MS = 45_000;
const DEDUP_WINDOW_MS = 10 * 60_000; // 10분: 같은 다운 구간 내 중복 알림 억제

export function isWorkerAlertEnabled(): boolean {
  return env.DISCORD_WORKER_ALERT_WEBHOOK.length > 0;
}

export async function maybeAlertWorkerDown(params: {
  jobId: string;
  videoOriginalName?: string | null;
}): Promise<void> {
  if (!isWorkerAlertEnabled()) return;
  const log = logger.child({ jobId: params.jobId, notify: 'worker-alert' });

  try {
    const now = Date.now();
    const dedupSince = new Date(now - DEDUP_WINDOW_MS).toISOString();

    // 1) 워커 생존 판정: 하트비트가 신선하면 살아있음 → 알림 생략
    const hb = await getWorkerHeartbeatTs();
    if (hb !== null && now - hb < HEARTBEAT_FRESH_MS) {
      log.info({ ageMs: now - hb }, 'worker heartbeat fresh — skip alert');
      return;
    }

    const admin = createAdminClient();

    // 2) 버스트 중복 제거: 이 잡 외 최근 큐 적체가 있으면 이미 알림 나감 → 생략
    const { data: others } = await admin
      .from('jobs')
      .select('id')
      .eq('status', 'queued')
      .neq('id', params.jobId)
      .gte('created_at', dedupSince)
      .limit(1);
    if (others && others.length > 0) {
      log.info('recent queued job exists — likely already alerted, skip');
      return;
    }

    // 3) 알림 발송
    const site = env.NEXT_PUBLIC_APP_URL;
    const name = params.videoOriginalName?.trim() || '영상';
    const content =
      `🔔 **자막 요청이 들어왔어요 — 워커를 켜주세요.**\n` +
      `\`${name}\` 가 큐에서 대기 중입니다. PC에서 \`npm run worker:poll\`을 실행하면 처리됩니다.\n` +
      `${site}/jobs`;

    const res = await fetch(env.DISCORD_WORKER_ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, 'discord webhook 발송 실패');
    } else {
      log.info('worker-down alert 발송');
    }
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'maybeAlertWorkerDown 실패 (무시)');
  }
}
