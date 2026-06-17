import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * setNotifyChannel 가드 로직 — 미연결 시 discord/both 거부, 비로그인 거부.
 * supabase/server·env·user-profile는 mock (next/headers·DB 불필요).
 */

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000', DISCORD_OAUTH_REDIRECT_URL: '' } }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/services/auth/user-profile', () => ({
  readDiscordState: vi.fn(),
  clearDiscordIdentity: vi.fn(),
  setNotifyChannelRow: vi.fn(),
}));

import { setNotifyChannel } from '@/services/auth/discord';
import { readDiscordState, setNotifyChannelRow } from '@/services/auth/user-profile';

const linked = { userId: 'u1', linked: true, discordUsername: 'name', notifyChannel: 'email', dmBlocked: false } as const;
const unlinked = { userId: 'u1', linked: false, discordUsername: null, notifyChannel: 'email', dmBlocked: false } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setNotifyChannelRow).mockResolvedValue(undefined);
});

describe('setNotifyChannel', () => {
  it('비로그인 → 에러, 쓰기 안 함', async () => {
    vi.mocked(readDiscordState).mockResolvedValue(null);
    const r = await setNotifyChannel('email');
    expect(r).toEqual({ error: '로그인이 필요합니다.' });
    expect(setNotifyChannelRow).not.toHaveBeenCalled();
  });

  it("미연결 + 'discord' → 거부", async () => {
    vi.mocked(readDiscordState).mockResolvedValue({ ...unlinked });
    const r = await setNotifyChannel('discord');
    expect(r).toEqual({ error: 'Discord 연결 후 선택할 수 있어요.' });
    expect(setNotifyChannelRow).not.toHaveBeenCalled();
  });

  it("미연결 + 'both' → 거부", async () => {
    vi.mocked(readDiscordState).mockResolvedValue({ ...unlinked });
    const r = await setNotifyChannel('both');
    expect('error' in r).toBe(true);
    expect(setNotifyChannelRow).not.toHaveBeenCalled();
  });

  it("미연결 + 'email' → 허용", async () => {
    vi.mocked(readDiscordState).mockResolvedValue({ ...unlinked });
    const r = await setNotifyChannel('email');
    expect(r).toEqual({ ok: true });
    expect(setNotifyChannelRow).toHaveBeenCalledWith('email');
  });

  it("연결됨 + 'both' → 허용", async () => {
    vi.mocked(readDiscordState).mockResolvedValue({ ...linked });
    const r = await setNotifyChannel('both');
    expect(r).toEqual({ ok: true });
    expect(setNotifyChannelRow).toHaveBeenCalledWith('both');
  });
});
