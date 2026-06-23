import type { NextRequest } from 'next/server';
import { AppError, apiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getOwnerContext } from '@/services/auth/session';
import { getJobAdmin } from '@/services/jobs';
import { getRenderAdmin, getRenderStreamSnapshot } from '@/services/render';

/**
 * GET /api/renders/[renderId]/stream
 *
 * 번인 렌더 진행 상태 Server-Sent Events. 2초 간격 폴링 → status/progress 변화 시 푸시.
 * done|failed 도달 시 자동 종료. STT 잡 스트림(jobs/[id]/stream)과 동일 패턴.
 *
 * Client:
 *   const es = new EventSource(`/api/renders/${id}/stream`);
 *   es.addEventListener('status', (e) => { const { status, progress, downloadUrl } = JSON.parse(e.data); ... });
 */
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2_000;
const MAX_DURATION_MS = 30 * 60_000;

export async function GET(req: NextRequest, ctx: { params: Promise<{ renderId: string }> }) {
  const { renderId } = await ctx.params;
  const log = logger.child({ route: 'renders/stream', renderId });

  // 소유 검증 1회 (스트림 시작 전). render → job → owner.
  try {
    const owner = await getOwnerContext();
    const render = await getRenderAdmin(renderId);
    if (!render) return apiError('NOT_FOUND', '렌더를 찾을 수 없습니다.');
    const job = await getJobAdmin(render.jobId);
    if (!job) return apiError('NOT_FOUND', '렌더의 원본 잡을 찾을 수 없습니다.');
    const isOwner =
      owner.kind === 'user' ? job.userId === owner.userId : job.ownerId === owner.anonymousId;
    if (!isOwner) return apiError('FORBIDDEN', '이 렌더에 접근할 권한이 없습니다.');
  } catch (err) {
    if (err instanceof AppError) return apiError(err.code, err.message, err.details);
    return apiError('INTERNAL', '인증 확인 실패');
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let lastSerialized = '';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const sendComment = (msg: string) => {
        controller.enqueue(encoder.encode(`: ${msg}\n\n`));
      };

      let closed = false;
      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener('abort', onAbort);

      try {
        sendComment('connected');

        while (!closed) {
          if (Date.now() - startedAt > MAX_DURATION_MS) {
            send('timeout', { reason: 'max-duration' });
            break;
          }

          const snap = await getRenderStreamSnapshot(renderId).catch((err) => {
            log.warn({ err }, 'poll fetch failed');
            return null;
          });
          if (!snap) {
            send('error', { code: 'NOT_FOUND' });
            break;
          }

          const payload = {
            status: snap.status,
            progress: snap.progressPercent,
            downloadUrl: snap.downloadUrl,
            errorMessage: snap.errorMessage,
          };
          const serialized = JSON.stringify(payload);
          if (serialized !== lastSerialized) {
            send('status', payload);
            lastSerialized = serialized;
          } else {
            sendComment('keepalive');
          }

          if (snap.status === 'done' || snap.status === 'failed') {
            send('done', { status: snap.status });
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
