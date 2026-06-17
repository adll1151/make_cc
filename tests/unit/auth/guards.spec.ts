import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertCanUpload } from '@/services/auth/guards';
import { AppError } from '@/lib/api';
import type { OwnerContext } from '@/types/session';

vi.mock('@/services/auth/quotas', () => ({
  getGuestDailyUsage: vi.fn(),
}));

const { getGuestDailyUsage } = await import('@/services/auth/quotas');

const guest: OwnerContext = { kind: 'guest', anonymousId: 'anon-1' };
const user: OwnerContext = {
  kind: 'user',
  userId: 'u_1',
  email: 'a@b.com',
};

const MB = 1024 * 1024;

beforeEach(() => {
  vi.mocked(getGuestDailyUsage).mockResolvedValue({
    date: '2026-06-13',
    totalJobs: 0,
    totalDurationSec: 0,
  });
});

describe('assertCanUpload', () => {
  describe('MIME 검증', () => {
    it('허용된 mp4는 통과', async () => {
      await expect(
        assertCanUpload(guest, { fileSizeBytes: 10 * MB, durationSec: 60, mimeType: 'video/mp4' }),
      ).resolves.toBeUndefined();
    });

    it('허용되지 않은 mime은 UNSUPPORTED_MEDIA_TYPE', async () => {
      await expectAppError(
        assertCanUpload(guest, { fileSizeBytes: 10 * MB, durationSec: 60, mimeType: 'video/avi' }),
        'UNSUPPORTED_MEDIA_TYPE',
      );
    });
  });

  describe('방어적 입력 검증', () => {
    it('파일 크기 0은 INVALID_INPUT', async () => {
      await expectAppError(
        assertCanUpload(guest, { fileSizeBytes: 0, durationSec: 60, mimeType: 'video/mp4' }),
        'INVALID_INPUT',
      );
    });

    it('영상 길이 0은 INVALID_INPUT', async () => {
      await expectAppError(
        assertCanUpload(guest, { fileSizeBytes: MB, durationSec: 0, mimeType: 'video/mp4' }),
        'INVALID_INPUT',
      );
    });
  });

  describe('게스트 캡', () => {
    it('5분 200MB는 통과', async () => {
      await expect(
        assertCanUpload(guest, {
          fileSizeBytes: 200 * MB,
          durationSec: 300,
          mimeType: 'video/mp4',
        }),
      ).resolves.toBeUndefined();
    });

    it('6분 영상은 PAYLOAD_TOO_LARGE (회원가입 안내 포함)', async () => {
      const err = await expectAppError(
        assertCanUpload(guest, {
          fileSizeBytes: 100 * MB,
          durationSec: 360,
          mimeType: 'video/mp4',
        }),
        'PAYLOAD_TOO_LARGE',
      );
      expect(err.message).toContain('회원가입');
      expect(err.details?.upgradeUrl).toBe('/login');
    });

    it('250MB 파일은 PAYLOAD_TOO_LARGE', async () => {
      await expectAppError(
        assertCanUpload(guest, {
          fileSizeBytes: 250 * MB,
          durationSec: 100,
          mimeType: 'video/mp4',
        }),
        'PAYLOAD_TOO_LARGE',
      );
    });

    it('일일 잡 캡 도달 시 QUOTA_EXCEEDED', async () => {
      vi.mocked(getGuestDailyUsage).mockResolvedValue({
        date: '2026-06-13',
        totalJobs: 500, // env default
        totalDurationSec: 0,
      });
      const err = await expectAppError(
        assertCanUpload(guest, {
          fileSizeBytes: MB,
          durationSec: 60,
          mimeType: 'video/mp4',
        }),
        'QUOTA_EXCEEDED',
      );
      expect(err.details?.reason).toBe('guest_daily_jobs');
      expect(err.details?.upgradeUrl).toBe('/login');
    });

    it('누적 길이 + 신규 길이가 캡 초과 시 QUOTA_EXCEEDED', async () => {
      vi.mocked(getGuestDailyUsage).mockResolvedValue({
        date: '2026-06-13',
        totalJobs: 10,
        totalDurationSec: 35_900, // cap=36000, 100s 여유
      });
      const err = await expectAppError(
        assertCanUpload(guest, {
          fileSizeBytes: MB,
          durationSec: 200, // 합산 시 36100 > 36000
          mimeType: 'video/mp4',
        }),
        'QUOTA_EXCEEDED',
      );
      expect(err.details?.reason).toBe('guest_daily_duration');
    });

    it('누적 길이 합산이 캡 이하면 통과', async () => {
      vi.mocked(getGuestDailyUsage).mockResolvedValue({
        date: '2026-06-13',
        totalJobs: 10,
        totalDurationSec: 30_000,
      });
      await expect(
        assertCanUpload(guest, {
          fileSizeBytes: MB,
          durationSec: 100,
          mimeType: 'video/mp4',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('회원 캡', () => {
    it('30분 1GB는 통과', async () => {
      await expect(
        assertCanUpload(user, {
          fileSizeBytes: 1024 * MB,
          durationSec: 1800,
          mimeType: 'video/mp4',
        }),
      ).resolves.toBeUndefined();
    });

    it('31분 영상은 PAYLOAD_TOO_LARGE', async () => {
      await expectAppError(
        assertCanUpload(user, {
          fileSizeBytes: 100 * MB,
          durationSec: 1860,
          mimeType: 'video/mp4',
        }),
        'PAYLOAD_TOO_LARGE',
      );
    });

    it('1.5GB 파일은 PAYLOAD_TOO_LARGE', async () => {
      await expectAppError(
        assertCanUpload(user, {
          fileSizeBytes: 1536 * MB,
          durationSec: 300,
          mimeType: 'video/mp4',
        }),
        'PAYLOAD_TOO_LARGE',
      );
    });

    it('회원은 게스트 글로벌 캡을 호출하지 않는다', async () => {
      vi.mocked(getGuestDailyUsage).mockClear();
      await assertCanUpload(user, {
        fileSizeBytes: 100 * MB,
        durationSec: 300,
        mimeType: 'video/mp4',
      });
      expect(getGuestDailyUsage).not.toHaveBeenCalled();
    });
  });
});

// ----- helpers -----

async function expectAppError<T>(p: Promise<T>, code: string): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(code);
    return err as AppError;
  }
  throw new Error(`expected AppError(${code}), but promise resolved`);
}
