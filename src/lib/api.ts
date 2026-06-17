import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

/**
 * 표준 API 응답 헬퍼 (Design §6.2)
 *
 * 성공:  { ok: true, data }
 * 실패:  { error: { code, message, details? } }
 *
 * 도메인 에러는 services에서 `AppError`를 throw하고, route는 `handleApiError`로 변환.
 */

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'QUOTA_EXCEEDED'
  | 'OVERLAP'
  | 'WORKER_BUSY'
  | 'STT_FAILED'
  | 'INTERNAL';

const CODE_TO_STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  QUOTA_EXCEEDED: 429,
  OVERLAP: 400,
  WORKER_BUSY: 503,
  STT_FAILED: 500,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return CODE_TO_STATUS[this.code];
  }
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status: CODE_TO_STATUS[code] },
  );
}

export function handleApiError(err: unknown, requestId?: string): NextResponse {
  if (err instanceof AppError) {
    return apiError(err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return apiError('INVALID_INPUT', '입력값이 올바르지 않습니다.', {
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  // 그 외는 INTERNAL로 마스킹 + 로그
  const errorId = Math.random().toString(36).slice(2, 10);
  logger.error({ err, errorId, requestId }, 'unhandled api error');
  return apiError('INTERNAL', '예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', {
    errorId,
  });
}

/** Request 헤더에서 requestId 추출 (middleware가 주입) */
export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') ?? cryptoRandomId();
}

function cryptoRandomId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
