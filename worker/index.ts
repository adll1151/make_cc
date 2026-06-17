import { Worker } from 'bullmq';
import {
  bullConnection,
  TRANSCRIBE_QUEUE,
  RENDER_QUEUE,
  type TranscribeJobData,
  type RenderJobData,
} from '@/lib/redis';
import { logger } from '@/lib/logger';
import { processTranscribe } from './transcribe';
import { processRender } from './render';

/**
 * BullMQ Worker — 단일 프로세스에서 `transcribe`·`render` 두 큐를 consume.
 *
 * 실행: npm run worker (Redis 필요)
 * 종료: Ctrl+C → graceful shutdown
 *
 * Concurrency=1: GPU 메모리 한정이라 동시 1개. 향후 GPU 추가 시 늘림.
 * (Redis 없이 돌릴 때는 npm run worker:poll — DB 폴링 워커가 대체)
 */
const log = logger.child({ component: 'worker' });

const worker = new Worker<TranscribeJobData>(
  TRANSCRIBE_QUEUE,
  async (job) => {
    log.info({ bullJobId: job.id, jobId: job.data.jobId }, 'picked up');
    const result = await processTranscribe(job.data.jobId);
    return result;
  },
  {
    connection: bullConnection,
    concurrency: 1,
    lockDuration: 30 * 60_000, // 30분 — large 모델 + 긴 영상 대비
  },
);

worker.on('completed', (job, result) => {
  log.info({ bullJobId: job.id, result }, 'job completed');
});

worker.on('failed', (job, err) => {
  log.error({ bullJobId: job?.id, jobId: job?.data.jobId, err }, 'job failed');
});

worker.on('error', (err) => {
  log.error({ err }, 'worker error');
});

const renderWorker = new Worker<RenderJobData>(
  RENDER_QUEUE,
  async (job) => {
    log.info({ bullJobId: job.id, renderId: job.data.renderId }, 'render picked up');
    return await processRender(job.data.renderId);
  },
  {
    connection: bullConnection,
    concurrency: 1,
    lockDuration: 30 * 60_000, // 30분 — 긴 영상 번인 렌더 대비
  },
);

renderWorker.on('completed', (job, result) => {
  log.info({ bullJobId: job.id, result }, 'render completed');
});

renderWorker.on('failed', (job, err) => {
  log.error({ bullJobId: job?.id, renderId: job?.data.renderId, err }, 'render failed');
});

renderWorker.on('error', (err) => {
  log.error({ err }, 'render worker error');
});

log.info({ queues: [TRANSCRIBE_QUEUE, RENDER_QUEUE], concurrency: 1 }, 'worker started');

async function shutdown(signal: string) {
  log.info({ signal }, 'shutdown initiated');
  await Promise.all([worker.close(), renderWorker.close()]);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
