import IORedis, { type Redis } from 'ioredis';
import { Queue, QueueEvents, type ConnectionOptions } from 'bullmq';
import { env } from '@/lib/env';

/**
 * Redis + BullMQ 싱글톤.
 *
 * - `redis`: 일반 read/write (캡 카운터, anonymousId 조회 등)
 * - `bullConnection`: BullMQ용 connection options (URL 기반)
 * - `transcribeQueue`: STT 잡 큐
 *
 * BullMQ는 자체 ioredis를 번들하므로 Redis 인스턴스를 직접 넘기지 않고
 * connection options를 넘긴다 (버전 충돌 방지).
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  transcribeQueue: Queue<TranscribeJobData> | undefined;
  transcribeQueueEvents: QueueEvents | undefined;
  renderQueue: Queue<RenderJobData> | undefined;
};

export const redis: Redis =
  globalForRedis.redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

/**
 * BullMQ는 blocking 명령을 사용하므로 maxRetriesPerRequest=null 필요.
 * @see https://docs.bullmq.io/guide/connections
 */
export const bullConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const TRANSCRIBE_QUEUE = 'transcribe' as const;

export interface TranscribeJobData {
  jobId: string;
}

export const transcribeQueue: Queue<TranscribeJobData> =
  globalForRedis.transcribeQueue ??
  new Queue<TranscribeJobData>(TRANSCRIBE_QUEUE, {
    connection: bullConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });

export const transcribeQueueEvents: QueueEvents =
  globalForRedis.transcribeQueueEvents ??
  new QueueEvents(TRANSCRIBE_QUEUE, { connection: bullConnection });

export const RENDER_QUEUE = 'render' as const;

export interface RenderJobData {
  renderId: string;
}

/**
 * 번인 렌더 큐 (STT와 분리). 워커 프로세스는 1개를 공유하되
 * transcribe/render 두 큐를 각각 consume한다 (worker/index.ts).
 * Redis 미연결 시에는 DB 폴링 워커(poll-loop)가 pending 렌더를 대신 픽업.
 */
export const renderQueue: Queue<RenderJobData> =
  globalForRedis.renderQueue ??
  new Queue<RenderJobData>(RENDER_QUEUE, {
    connection: bullConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
  globalForRedis.transcribeQueue = transcribeQueue;
  globalForRedis.transcribeQueueEvents = transcribeQueueEvents;
  globalForRedis.renderQueue = renderQueue;
}
