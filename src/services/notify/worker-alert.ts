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

// 시작 시 마지막 하트비트가 이보다 오래됐으면 "워커가 꺼져 있었다"(복구)로 본다.
const RECOVERY_STALE_MS = 60_000;

export function isWorkerAlertEnabled(): boolean {
  return env.DISCORD_WORKER_ALERT_WEBHOOK.length > 0;
}

/** 운영 웹훅 발송 공통. res.ok 반환(로깅은 호출부). */
async function sendOpsWebhook(content: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(env.DISCORD_WORKER_ALERT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * 워커 기동/복구 알림 (poll-loop 부팅 시 1회).
 * 부팅 시점의 하트비트가 오래됐고(=꺼져 있었음) 적체 잡이 있으면 "복구", 그 외엔 "기동 완료".
 * 부팅당 1회만(둘 중 하나) 발송해 노이즈를 줄인다. Notification Matrix #2·#3.
 */
export async function alertWorkerOnline(params: {
  backlogCount: number;
  prevHeartbeatTs: number | null;
}): Promise<void> {
  if (!isWorkerAlertEnabled()) return;
  const log = logger.child({ notify: 'worker-online' });
  try {
    const now = Date.now();
    const wasDown =
      params.prevHeartbeatTs === null || now - params.prevHeartbeatTs > RECOVERY_STALE_MS;
    const site = env.NEXT_PUBLIC_APP_URL;
    const n = params.backlogCount;

    const content =
      wasDown && n > 0
        ? `♻️ **워커 복구됨**\n다운 상태에서 재가동되었습니다. 적체된 잡 ${n}건 처리를 시작합니다.\n${site}/jobs`
        : `✅ **워커 기동 완료**\npoll-loop 워커가 온라인입니다.` +
          (n > 0 ? ` 대기 중인 잡 ${n}건을 처리합니다.` : ' 대기 중인 잡을 처리합니다.');

    const { ok, status } = await sendOpsWebhook(content);
    if (!ok) log.warn({ status }, 'discord webhook 발송 실패');
    else log.info('ops alert 발송');
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'alertWorkerOnline 실패 (무시)');
  }
}

/**
 * 잡 처리 실패(시스템 오류) 운영 알림. 사용자 대상 DM(dispatchJobFailed)과 분리된
 * 운영자용 웹훅. markFailed 직후 best-effort로 호출. Notification Matrix #4.
 */
export async function alertJobFailed(params: {
  jobId: string;
  videoOriginalName?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  stage?: string;
}): Promise<void> {
  if (!isWorkerAlertEnabled()) return;
  const log = logger.child({ jobId: params.jobId, notify: 'job-failed' });
  try {
    const site = env.NEXT_PUBLIC_APP_URL;
    const name = params.videoOriginalName?.trim() || '영상';
    const shortId = params.jobId.slice(0, 8);
    const reason = params.errorCode || params.errorMessage || '알 수 없음';
    const stage = params.stage ? ` ${params.stage} 단계에서` : '';
    const content =
      `⚠️ **잡 처리 실패**\n` +
      `\`${name}\` (job ${shortId}…) 처리 중${stage} 실패했습니다. 사유: \`${reason}\`\n` +
      `${site}/jobs`;
    const { ok, status } = await sendOpsWebhook(content);
    if (!ok) log.warn({ status }, 'discord webhook 발송 실패');
    else log.info('ops alert 발송');
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'alertJobFailed 실패 (무시)');
  }
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

    const { ok, status } = await sendOpsWebhook(content);
    if (!ok) log.warn({ status }, 'discord webhook 발송 실패');
    else log.info('ops alert 발송');
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'maybeAlertWorkerDown 실패 (무시)');
  }
}
