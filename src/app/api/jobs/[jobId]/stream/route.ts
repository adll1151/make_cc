import type { NextRequest } from 'next/server';
import { AppError, apiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';
import { isTerminal } from '@/services/jobs/state-machine';

/**
 * GET /api/jobs/[jobId]/stream
 *
 * Server-Sent Events 스트림. 2초 간격 폴링하여 status/progress 변화 시 푸시.
 * terminal 상태 도달 시 자동 종료.
 *
 * Client EventSource 사용 예:
 *   const es = new EventSource(`/api/jobs/${id}/stream`);
 *   es.addEventListener('status', (e) => { const data = JSON.parse(e.data); ... });
 *
 * Last-Event-ID 헤더는 미지원 (MVP). progress가 단조 증가라 idempotent 재연결 가능.
 */
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2_000;
const MAX_DURATION_MS = 30 * 60_000; // 30분 (large 모델 대비)

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const log = logger.child({ route: 'jobs/stream', jobId });

  // 인증 검증
  let isAuthorized = false;
  try {
    const owner = await getOwnerContext();
    const job = await getJobAdmin(jobId);
    if (!job) return apiError('NOT_FOUND', '잡을 찾을 수 없습니다.');
    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) return apiError('FORBIDDEN', '이 잡에 접근할 권한이 없습니다.');
    isAuthorized = true;
  } catch (err) {
    if (err instanceof AppError) return apiError(err.code, err.message, err.details);
    return apiError('INTERNAL', '인증 확인 실패');
  }

  if (!isAuthorized) return apiError('FORBIDDEN', '권한 없음'); // 도달 안 함

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let lastSerialized = '';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const sendComment = (msg: string) => {
        controller.enqueue(encoder.encode(`: ${msg}\n\n`));
      };

      // 클라이언트 연결 종료 감지
      let closed = false;
      const onAbort = () => {
        closed = true;
        log.info('client disconnected');
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener('abort', onAbort);

      try {
        // 초기 keepalive
        sendComment('connected');

        while (!closed) {
          if (Date.now() - startedAt > MAX_DURATION_MS) {
            send('timeout', { reason: 'max-duration' });
            break;
          }

          const job = await getJobAdmin(jobId).catch((err) => {
            log.warn({ err }, 'poll fetch failed');
            return null;
          });
          if (!job) {
            send('error', { code: 'NOT_FOUND' });
            break;
          }

          const payload = {
            status: job.status,
            progress: job.progressPercent,
            queuePosition: job.queuePosition,
            hasSubtitle: !!job.subtitleStorageKey,
            errorCode: job.errorCode,
            errorMessage: job.errorMessage,
          };
          const serialized = JSON.stringify(payload);
          if (serialized !== lastSerialized) {
            send('status', payload);
            lastSerialized = serialized;
          } else {
            sendComment('keepalive');
          }

          if (isTerminal(job.status)) {
            send('done', { status: job.status });
            break;
          }

          await sleep(POLL_INTERVAL_MS);
        }
      } catch (err) {
        log.error({ err }, 'stream error');
        send('error', { code: 'INTERNAL' });
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
