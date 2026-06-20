import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * BullMQ 큐 싱글톤.
 *
 * - `bullConnection`: BullMQ용 connection options (URL 기반)
 * - `transcribeQueue` / `renderQueue`: enqueue 전용 (웹). 워커는 자체 Worker 생성.
 *
 * ⚠️ Redis 미연결 graceful degrade (Design): Vercel 서버리스에서 Redis가 없거나
 * 닿지 않아도 enqueue는 try/catch+timeout으로 false 반환(services/queue), 잡은 DB에서
 * queued로 남아 polling 워커가 픽업한다. 단, ioredis가 'error' 이벤트를 발생시켰을 때
 * 리스너가 없으면 EventEmitter가 throw해 서버리스 함수를 죽이므로(=업로드→큐 대기 화면
 * 멈춤의 원인), 모든 Queue에 'error' 핸들러를 반드시 붙인다. 또한 import만으로 즉시
 * blocking 연결을 여는 QueueEvents/raw IORedis 싱글톤은 어디서도 쓰지 않아 제거했다.
 */

const globalForRedis = globalThis as unknown as {
  transcribeQueue: Queue<TranscribeJobData> | undefined;
  renderQueue: Queue<RenderJobData> | undefined;
};

/**
 * BullMQ는 blocking 명령을 사용하므로 maxRetriesPerRequest=null 필요.
 * @see https://docs.bullmq.io/guide/connections
 */
export const bullConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // 실제 enqueue(.add) 전까진 연결하지 않음. DB 폴링 워커(worker:poll)는 큐를
  // 쓰지 않으므로 import만으로 연결 시도→에러 스팸 하던 것을 없앤다. 웹 enqueue는
  // 첫 .add 때 연결 시도(실패해도 services/queue가 timeout+graceful false 처리).
  lazyConnect: true,
};

/**
 * Queue의 연결 'error'를 삼켜 미처리 이벤트로 인한 함수 크래시를 방지.
 * ioredis는 재연결마다 'error'를 반복 발생시키므로 큐당 1회만 로그(스팸 방지).
 * 특히 DB 폴링 워커(worker:poll)는 큐를 안 쓰는데 BullMQ가 시작 시 연결을 시도해
 * 3초마다 같은 에러를 찍던 것을 잡는다.
 */
function attachErrorHandler<T>(queue: Queue<T>, name: string): Queue<T> {
  let logged = false;
  queue.on('error', (err) => {
    if (logged) return;
    logged = true;
    logger.warn(
      { err: (err as Error)?.message, queue: name },
      'BullMQ 큐 연결 오류 (이후 동일 오류는 생략, Redis 미연결 시 정상)',
    );
  });
  return queue;
}

export const TRANSCRIBE_QUEUE = 'transcribe' as const;

export interface TranscribeJobData {
  jobId: string;
}

export const transcribeQueue: Queue<TranscribeJobData> =
  globalForRedis.transcribeQueue ??
  attachErrorHandler(
    new Queue<TranscribeJobData>(TRANSCRIBE_QUEUE, {
      connection: bullConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
    TRANSCRIBE_QUEUE,
  );

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
  attachErrorHandler(
    new Queue<RenderJobData>(RENDER_QUEUE, {
      connection: bullConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
    RENDER_QUEUE,
  );

// dev에서 HMR 재생성 방지(연결 누수) — prod는 매 인스턴스 새로 생성.
if (env.NODE_ENV !== 'production') {
  globalForRedis.transcribeQueue = transcribeQueue;
  globalForRedis.renderQueue = renderQueue;
}
