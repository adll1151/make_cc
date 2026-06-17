import { transcribeQueue, renderQueue, type TranscribeJobData, type RenderJobData } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { OwnerType } from '@/types/job';

/**
 * STT 큐 서비스 (BullMQ 래퍼).
 *
 * 우선순위 정책:
 *   - 회원 (user): priority = 1 (높음)
 *   - 게스트 (guest): priority = 5 (낮음)
 *
 * BullMQ priority는 작을수록 우선 (1이 최우선).
 *
 * jobId를 BullMQ jobId로 사용하여 중복 enqueue 방지 (멱등성).
 *
 * Graceful degrade: Redis 미연결 환경에서도 호출자가 깨지지 않도록
 * 시도 → 실패 시 false 반환 + 경고 로그 (polling worker가 대체).
 */

const PRIORITY: Readonly<Record<OwnerType, number>> = {
  user: 1,
  guest: 5,
};

const ENQUEUE_TIMEOUT_MS = 1500;

/**
 * 큐에 enqueue 시도. 성공 true, 실패(연결 안 됨 등) false.
 * 절대 throw하지 않음 — 호출자가 응답 흐름을 차단하지 않도록.
 */
export async function enqueueTranscribe(params: {
  jobId: string;
  ownerType: OwnerType;
}): Promise<boolean> {
  try {
    const enqueuePromise = transcribeQueue.add(
      'transcribe',
      { jobId: params.jobId } satisfies TranscribeJobData,
      {
        jobId: params.jobId,
        priority: PRIORITY[params.ownerType],
      },
    );
    await Promise.race([
      enqueuePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('enqueue timeout')), ENQUEUE_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message, jobId: params.jobId },
      'BullMQ enqueue 실패 (Redis 미연결?). polling worker가 처리할 수 있음.',
    );
    return false;
  }
}

/**
 * 번인 렌더 enqueue 시도. 성공 true, 실패(연결 안 됨 등) false.
 * enqueueTranscribe와 동일하게 절대 throw하지 않음 — Redis 미연결이어도
 * DB 폴링 워커(poll-loop)가 pending 렌더를 대신 픽업하므로 응답을 막지 않는다.
 * renderId를 BullMQ jobId로 써 중복 enqueue 방지(멱등성).
 */
export async function enqueueRender(params: { renderId: string }): Promise<boolean> {
  try {
    const enqueuePromise = renderQueue.add(
      'render',
      { renderId: params.renderId } satisfies RenderJobData,
      { jobId: params.renderId },
    );
    await Promise.race([
      enqueuePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('enqueue timeout')), ENQUEUE_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message, renderId: params.renderId },
      'render enqueue 실패 (Redis 미연결?). polling worker가 처리할 수 있음.',
    );
    return false;
  }
}

/**
 * 큐 내 잡의 현재 대기 위치 (1부터).
 * 활성 처리 중이거나 큐에 없으면 null.
 */
export async function getQueuePosition(jobId: string): Promise<number | null> {
  const waitingJobs = await transcribeQueue.getJobs(['waiting', 'delayed', 'prioritized'], 0, 1000);
  const index = waitingJobs.findIndex((j) => j.id === jobId);
  return index >= 0 ? index + 1 : null;
}

/** 큐에서 잡 제거 (취소 처리 시) */
export async function removeFromQueue(jobId: string): Promise<boolean> {
  const job = await transcribeQueue.getJob(jobId);
  if (!job) return false;
  await job.remove();
  return true;
}

/** 큐 상태 요약 (모니터링·헬스체크용) */
export async function getQueueSnapshot(): Promise<{
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}> {
  const counts = await transcribeQueue.getJobCounts(
    'waiting',
    'active',
    'delayed',
    'failed',
  );
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
  };
}

export const QUEUE_PRIORITIES = PRIORITY;
