import pino from 'pino';
import { env } from '@/lib/env';

/**
 * 표준 JSON 로거.
 * - 개발: pino-pretty 사용 (가독성)
 * - 운영: JSON 라인 출력 (Vercel 로그 호환)
 *
 * 각 요청에 대해 child 로거를 만들어 requestId를 binding 한다.
 */

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'make-cc-web',
    env: env.NODE_ENV,
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,env',
        },
      }
    : undefined,
});

export function withRequest(requestId: string) {
  return logger.child({ requestId });
}

export type Logger = typeof logger;
