/**
 * CLI: Polling worker — Redis 없이 큐 동작 대체.
 *
 * 사용:
 *   npm run worker:poll
 *
 * 동작:
 *   - 3초마다 jobs 테이블 스캔 (status='queued')
 *   - 가장 오래된 잡 1개를 골라 processTranscribe 호출
 *   - 처리 완료 후 다시 스캔
 *   - Ctrl+C로 graceful shutdown
 *
 * concurrency=1 (GPU 한 대 가정).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { cleanupExpiredJobs } from '@/services/jobs';
import { fetchOldestPendingRender, cleanupExpiredRenders } from '@/services/render';
import { fetchOldestPendingTranslation, cleanupExpiredTranslations } from '@/services/translation';
import { putWorkerHeartbeat } from '@/services/storage';
import { processTranscribe } from '../transcribe';
import { processRender } from '../render';
import { processTranslation } from '../translate';

const POLL_INTERVAL_MS = 3_000;
// 잡 처리(블로킹)와 무관하게 setInterval로 갱신 — 운영자 알림이 워커 생존을 판정.
const HEARTBEAT_INTERVAL_MS = 15_000;

const log = logger.child({ worker: 'poll-loop' });

async function touchHeartbeat(): Promise<void> {
  try {
    await putWorkerHeartbeat();
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'heartbeat 기록 실패 (계속)');
  }
}

let isShuttingDown = false;

process.on('SIGINT', () => {
  log.info('SIGINT — shutting down after current job');
  isShuttingDown = true;
});
process.on('SIGTERM', () => {
  log.info('SIGTERM — shutting down after current job');
  isShuttingDown = true;
});

// cleanup은 잡 처리보다 덜 자주 (10번 폴링당 1회 = 30초마다)
const CLEANUP_EVERY_N_TICKS = 10;
let tickCount = 0;

(async function main() {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'polling worker started');

  // 하트비트: 시작 즉시 1회 + 주기적. 잡 처리로 메인 루프가 블록돼도 계속 갱신됨.
  await touchHeartbeat();
  const heartbeatTimer = setInterval(() => void touchHeartbeat(), HEARTBEAT_INTERVAL_MS);

  while (!isShuttingDown) {
    // cleanup (만료 자산 자동 삭제) — 잡 비디오 + 렌더 출력
    if (tickCount % CLEANUP_EVERY_N_TICKS === 0) {
      try {
        const r = await cleanupExpiredJobs();
        if (r.scanned > 0 || r.errors > 0) {
          log.info({ cleanup: r }, 'job cleanup tick');
        }
      } catch (err) {
        log.warn({ err: (err as Error)?.message }, 'job cleanup failed (계속)');
      }
      try {
        const rr = await cleanupExpiredRenders();
        if (rr.scanned > 0 || rr.errors > 0) {
          log.info({ cleanup: rr }, 'render cleanup tick');
        }
      } catch (err) {
        log.warn({ err: (err as Error)?.message }, 'render cleanup failed (계속)');
      }
      try {
        const tr = await cleanupExpiredTranslations();
        if (tr.scanned > 0 || tr.errors > 0) {
          log.info({ cleanup: tr }, 'translation cleanup tick');
        }
      } catch (err) {
        log.warn({ err: (err as Error)?.message }, 'translation cleanup failed (계속)');
      }
    }
    tickCount += 1;

    // 1) 번인 렌더(pending) 우선 — 사용자 대화형 요청이라 응답성 우선
    const renderId = await fetchPendingRender();
    if (renderId) {
      log.info({ renderId }, 'picked up pending render');
      try {
        const result = await processRender(renderId);
        log.info({ renderId, result }, 'render done');
      } catch (err) {
        log.error({ renderId, err: (err as Error)?.message }, 'render failed');
        // markRenderFailed는 processRender 내부에서 수행됨 — 폴링 계속
      }
      continue; // 다음 틱에서 다시 스캔
    }

    // 2) 번역(pending) — DeepL REST, GPU 불필요. STT보다 빠르므로 우선.
    const translationId = await fetchPendingTranslation();
    if (translationId) {
      log.info({ translationId }, 'picked up pending translation');
      try {
        const result = await processTranslation(translationId);
        log.info({ translationId, result }, 'translation done');
      } catch (err) {
        log.error({ translationId, err: (err as Error)?.message }, 'translation failed');
        // markTranslationFailed는 processTranslation 내부에서 수행됨 — 폴링 계속
      }
      continue; // 다음 틱에서 다시 스캔
    }

    // 3) STT 잡(queued)
    const jobId = await fetchOldestQueued();
    if (!jobId) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    log.info({ jobId }, 'picked up queued job');
    try {
      const result = await processTranscribe(jobId);
      log.info({ jobId, result }, 'transcribe done');
    } catch (err) {
      log.error({ jobId, err: (err as Error)?.message }, 'transcribe failed');
      // markFailed는 processTranscribe 내부에서 수행됨 — 폴링 계속
    }
  }

  clearInterval(heartbeatTimer);
  log.info('shutdown complete');
  process.exit(0);
})().catch((err) => {
  log.error({ err }, 'poll-loop crashed');
  process.exit(1);
});

async function fetchPendingRender(): Promise<string | null> {
  try {
    return await fetchOldestPendingRender();
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'fetch pending render failed');
    return null;
  }
}

async function fetchPendingTranslation(): Promise<string | null> {
  try {
    return await fetchOldestPendingTranslation();
  } catch (err) {
    log.warn({ err: (err as Error)?.message }, 'fetch pending translation failed');
    return null;
  }
}

async function fetchOldestQueued(): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('jobs')
    .select('id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    log.warn({ err: error.message }, 'fetch queued failed');
    return null;
  }
  return data?.[0]?.id ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
