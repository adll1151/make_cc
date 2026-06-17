import type { JobStatus } from '@/types/job';

/**
 * 잡 상태 머신 (Design §3.1).
 *
 * 전이 규칙은 단방향:
 *   pending → uploading | cancelled
 *   uploading → queued | failed | cancelled
 *   queued → transcribing | cancelled
 *   transcribing → finished | failed | cancelled
 *   finished, failed, cancelled → (terminal)
 *
 * 모든 전이는 `services/jobs/service.ts`의 transitionStatus를 거치며,
 * 직접 DB update 금지 (ESLint로는 강제 불가, 컨벤션).
 */

const ALLOWED: Readonly<Record<JobStatus, ReadonlyArray<JobStatus>>> = {
  pending: ['uploading', 'cancelled'],
  uploading: ['queued', 'failed', 'cancelled'],
  queued: ['transcribing', 'cancelled'],
  transcribing: ['finished', 'failed', 'cancelled'],
  finished: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function isTerminal(status: JobStatus): boolean {
  return ALLOWED[status].length === 0;
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidJobTransitionError(from, to);
  }
}

export class InvalidJobTransitionError extends Error {
  constructor(
    public from: JobStatus,
    public to: JobStatus,
  ) {
    super(`잘못된 잡 상태 전이: ${from} → ${to}`);
    this.name = 'InvalidJobTransitionError';
  }
}

/** 현재 상태에서 가능한 다음 상태들 (UI 가이드, 디버깅용) */
export function nextAllowed(from: JobStatus): ReadonlyArray<JobStatus> {
  return ALLOWED[from];
}
