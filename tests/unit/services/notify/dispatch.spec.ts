import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * dispatchJobCompleted / dispatchJobFailed 라우팅 매트릭스.
 * profile/service/discord는 mock — dispatcher의 분기·fallback만 검증.
 */

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' } }));
vi.mock('@/services/notify/profile', () => ({
  getUserNotifyProfile: vi.fn(),
  markDmBlocked: vi.fn(),
}));
vi.mock('@/services/notify/service', () => ({
  sendJobCompleted: vi.fn(),
  sendJobFailed: vi.fn(),
}));
vi.mock('@/services/notify/discord', () => ({
  sendDiscordDM: vi.fn(),
}));
vi.mock('@/services/jobs/events', () => ({
  hasJobEvent: vi.fn(),
  appendJobEvent: vi.fn(),
}));

import { dispatchJobCompleted, dispatchJobFailed } from '@/services/notify/dispatch';
import { getUserNotifyProfile, markDmBlocked } from '@/services/notify/profile';
import { sendJobCompleted, sendJobFailed } from '@/services/notify/service';
import { sendDiscordDM } from '@/services/notify/discord';
import { hasJobEvent, appendJobEvent } from '@/services/jobs/events';
import type { NotifyProfile } from '@/types/user';

const completedCtx = {
  jobId: 'j1',
  ownerType: 'user' as const,
  userId: 'u1',
  videoOriginalName: 'video.mp4',
  videoDurationSec: 60,
  cueCount: 12,
};

function profile(p: Partial<NotifyProfile>): NotifyProfile {
  return { notifyChannel: 'email', discordUserId: null, discordDmBlocked: false, ...p };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendJobCompleted).mockResolvedValue({ sent: true } as never);
  vi.mocked(sendJobFailed).mockResolvedValue({ sent: true } as never);
  vi.mocked(sendDiscordDM).mockResolvedValue({ channel: 'discord', ok: true });
  vi.mocked(hasJobEvent).mockResolvedValue(false);
  vi.mocked(appendJobEvent).mockResolvedValue(undefined);
});

describe('dispatchJobCompleted 라우팅', () => {
  it("channel='email' → 이메일만, Discord 미호출", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(profile({ notifyChannel: 'email' }));
    const out = await dispatchJobCompleted(completedCtx);
    expect(sendJobCompleted).toHaveBeenCalledTimes(1);
    expect(sendDiscordDM).not.toHaveBeenCalled();
    expect(out).toEqual([{ channel: 'email', ok: true, reason: undefined }]);
  });

  it("channel='both' + linked → 이메일 + Discord 각 1회", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'both', discordUserId: 'd1' }),
    );
    const out = await dispatchJobCompleted(completedCtx);
    expect(sendJobCompleted).toHaveBeenCalledTimes(1);
    expect(sendDiscordDM).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(2);
  });

  it("channel='discord' + DM 성공 → Discord만, 이메일 0", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'discord', discordUserId: 'd1' }),
    );
    const out = await dispatchJobCompleted(completedCtx);
    expect(sendDiscordDM).toHaveBeenCalledTimes(1);
    expect(sendJobCompleted).not.toHaveBeenCalled();
    expect(out).toEqual([{ channel: 'discord', ok: true }]);
  });

  it("channel='discord' + DM 실패(error) → 이메일 fallback", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'discord', discordUserId: 'd1' }),
    );
    vi.mocked(sendDiscordDM).mockResolvedValue({ channel: 'discord', ok: false, reason: 'error' });
    const out = await dispatchJobCompleted(completedCtx);
    expect(sendDiscordDM).toHaveBeenCalledTimes(1);
    expect(sendJobCompleted).toHaveBeenCalledTimes(1); // fallback
    expect(out).toHaveLength(2);
  });

  it("channel='discord' + 50007 → markDmBlocked + 이메일 fallback", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'discord', discordUserId: 'd1' }),
    );
    vi.mocked(sendDiscordDM).mockResolvedValue({ channel: 'discord', ok: false, reason: 'blocked' });
    await dispatchJobCompleted(completedCtx);
    expect(markDmBlocked).toHaveBeenCalledWith('u1');
    expect(sendJobCompleted).toHaveBeenCalledTimes(1); // fallback
  });

  it('dm_blocked=true + both → Discord skip, 이메일만', async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'both', discordUserId: 'd1', discordDmBlocked: true }),
    );
    await dispatchJobCompleted(completedCtx);
    expect(sendDiscordDM).not.toHaveBeenCalled();
    expect(sendJobCompleted).toHaveBeenCalledTimes(1);
  });

  it('멱등 가드: 이미 notified 이벤트 있으면 skip (발송 0)', async () => {
    vi.mocked(hasJobEvent).mockResolvedValue(true);
    vi.mocked(getUserNotifyProfile).mockResolvedValue(profile({ notifyChannel: 'both', discordUserId: 'd1' }));
    const out = await dispatchJobCompleted(completedCtx);
    expect(out).toEqual([]);
    expect(sendJobCompleted).not.toHaveBeenCalled();
    expect(sendDiscordDM).not.toHaveBeenCalled();
    expect(appendJobEvent).not.toHaveBeenCalled();
  });

  it('발송 후 notified 이벤트 기록', async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(profile({ notifyChannel: 'email' }));
    await dispatchJobCompleted(completedCtx);
    expect(appendJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'j1', type: 'notified' }),
    );
  });

  it('게스트 → 프로필 조회 없이 이메일 경로', async () => {
    const guestCtx = { ...completedCtx, ownerType: 'guest' as const, userId: null };
    vi.mocked(sendJobCompleted).mockResolvedValue({ sent: false, reason: 'no-recipient' } as never);
    const out = await dispatchJobCompleted(guestCtx);
    expect(getUserNotifyProfile).not.toHaveBeenCalled();
    expect(sendDiscordDM).not.toHaveBeenCalled();
    expect(out).toEqual([{ channel: 'email', ok: false, reason: 'no-recipient' }]);
  });
});

describe('dispatchJobFailed 라우팅', () => {
  it("channel='discord' + 성공 → sendJobFailed 미호출, Discord 호출", async () => {
    vi.mocked(getUserNotifyProfile).mockResolvedValue(
      profile({ notifyChannel: 'discord', discordUserId: 'd1' }),
    );
    const out = await dispatchJobFailed({
      jobId: 'j1',
      ownerType: 'user',
      userId: 'u1',
      videoOriginalName: 'video.mp4',
      videoDurationSec: 60,
      errorMessage: 'STT timeout',
    });
    expect(sendDiscordDM).toHaveBeenCalledTimes(1);
    expect(sendJobFailed).not.toHaveBeenCalled();
    expect(out).toEqual([{ channel: 'discord', ok: true }]);
  });
});
