import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminal,
  assertTransition,
  nextAllowed,
  InvalidJobTransitionError,
} from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/job';

const ALL: JobStatus[] = [
  'pending',
  'uploading',
  'queued',
  'transcribing',
  'finished',
  'failed',
  'cancelled',
];

describe('canTransition', () => {
  describe('정상 경로 (happy path)', () => {
    it('pending → uploading', () => {
      expect(canTransition('pending', 'uploading')).toBe(true);
    });
    it('uploading → queued', () => {
      expect(canTransition('uploading', 'queued')).toBe(true);
    });
    it('queued → transcribing', () => {
      expect(canTransition('queued', 'transcribing')).toBe(true);
    });
    it('transcribing → finished', () => {
      expect(canTransition('transcribing', 'finished')).toBe(true);
    });
  });

  describe('실패/취소 경로', () => {
    it('uploading → failed', () => {
      expect(canTransition('uploading', 'failed')).toBe(true);
    });
    it('transcribing → failed', () => {
      expect(canTransition('transcribing', 'failed')).toBe(true);
    });
    it('pending/uploading/queued/transcribing → cancelled', () => {
      expect(canTransition('pending', 'cancelled')).toBe(true);
      expect(canTransition('uploading', 'cancelled')).toBe(true);
      expect(canTransition('queued', 'cancelled')).toBe(true);
      expect(canTransition('transcribing', 'cancelled')).toBe(true);
    });
  });

  describe('금지된 전이', () => {
    it('terminal에서 다른 상태로 전이 불가', () => {
      const terminals: JobStatus[] = ['finished', 'failed', 'cancelled'];
      for (const t of terminals) {
        for (const next of ALL) {
          expect(canTransition(t, next)).toBe(false);
        }
      }
    });

    it('역방향 전이 불가 (queued → uploading 등)', () => {
      expect(canTransition('queued', 'uploading')).toBe(false);
      expect(canTransition('transcribing', 'queued')).toBe(false);
      expect(canTransition('uploading', 'pending')).toBe(false);
    });

    it('건너뛰기 전이 불가 (pending → queued, queued → finished)', () => {
      expect(canTransition('pending', 'queued')).toBe(false);
      expect(canTransition('queued', 'finished')).toBe(false);
      expect(canTransition('pending', 'transcribing')).toBe(false);
    });

    it('자기 자신으로의 전이는 항상 false', () => {
      for (const s of ALL) {
        expect(canTransition(s, s)).toBe(false);
      }
    });
  });
});

describe('isTerminal', () => {
  it('finished, failed, cancelled만 terminal', () => {
    expect(isTerminal('finished')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
  });
  it('나머지는 non-terminal', () => {
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('uploading')).toBe(false);
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('transcribing')).toBe(false);
  });
});

describe('assertTransition', () => {
  it('허용된 전이는 통과', () => {
    expect(() => assertTransition('pending', 'uploading')).not.toThrow();
  });

  it('금지된 전이는 InvalidJobTransitionError', () => {
    expect(() => assertTransition('finished', 'pending')).toThrow(InvalidJobTransitionError);
    expect(() => assertTransition('queued', 'finished')).toThrow(InvalidJobTransitionError);
  });

  it('에러는 from/to 보존', () => {
    try {
      assertTransition('finished', 'uploading');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidJobTransitionError);
      expect((err as InvalidJobTransitionError).from).toBe('finished');
      expect((err as InvalidJobTransitionError).to).toBe('uploading');
    }
  });
});

describe('nextAllowed', () => {
  it('현재 상태의 가능한 다음 상태 목록', () => {
    expect([...nextAllowed('pending')].sort()).toEqual(['cancelled', 'uploading']);
    expect([...nextAllowed('uploading')].sort()).toEqual(['cancelled', 'failed', 'queued']);
    expect([...nextAllowed('queued')].sort()).toEqual(['cancelled', 'transcribing']);
    expect([...nextAllowed('transcribing')].sort()).toEqual(['cancelled', 'failed', 'finished']);
    expect(nextAllowed('finished')).toEqual([]);
    expect(nextAllowed('failed')).toEqual([]);
    expect(nextAllowed('cancelled')).toEqual([]);
  });
});
