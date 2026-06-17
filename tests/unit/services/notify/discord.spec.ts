import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * sendDiscordDM 단위 테스트 — REST 2-step, 429 backoff, 50007 차단.
 * fetch는 stub, env/logger는 mock (실제 토큰·pino 불필요).
 */

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { DISCORD_BOT_TOKEN: 'test-bot-token', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv }));
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({ info() {}, warn() {}, error() {}, debug() {} }),
  },
}));

import { sendDiscordDM, isDiscordBotEnabled } from '@/services/notify/discord';

interface FakeResInit {
  ok?: boolean;
  status?: number;
  body?: unknown;
  retryAfter?: string;
}

function res(init: FakeResInit): Response {
  const status = init.status ?? (init.ok === false ? 500 : 200);
  const ok = init.ok ?? (status >= 200 && status < 300);
  const body = init.body ?? {};
  const r = {
    ok,
    status,
    json: async () => body,
    clone: () => res(init),
    headers: {
      get: (k: string) => (k.toLowerCase() === 'retry-after' ? (init.retryAfter ?? null) : null),
    },
  };
  return r as unknown as Response;
}

const msg = { embed: { title: '테스트' } };

beforeEach(() => {
  mockEnv.DISCORD_BOT_TOKEN = 'test-bot-token';
  global.fetch = vi.fn() as unknown as typeof fetch;
});

describe('sendDiscordDM', () => {
  it('2-step 성공 → ok:true, 올바른 URL/페이로드', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(res({ ok: true, body: { id: 'dm-1' } }))
      .mockResolvedValueOnce(res({ ok: true, body: {} }));

    const r = await sendDiscordDM('discord-user-1', msg);

    expect(r).toMatchObject({ channel: 'discord', ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const [url1, init1] = calls[0]!;
    const [url2, init2] = calls[1]!;
    expect(url1).toContain('/users/@me/channels');
    expect(JSON.parse(init1.body)).toEqual({ recipient_id: 'discord-user-1' });
    expect(url2).toContain('/channels/dm-1/messages');
    expect(JSON.parse(init2.body)).toEqual({ embeds: [msg.embed] });
  });

  it('403 + code 50007 → reason:blocked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(res({ ok: true, body: { id: 'dm-1' } }))
      .mockResolvedValueOnce(res({ ok: false, status: 403, body: { code: 50007 } }));

    const r = await sendDiscordDM('discord-user-1', msg);
    expect(r).toEqual({ channel: 'discord', ok: false, reason: 'blocked' });
  });

  it('429 후 재시도 성공 (retry-after 0)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(res({ ok: true, body: { id: 'dm-1' } })) // 채널
      .mockResolvedValueOnce(res({ ok: false, status: 429, retryAfter: '0' })) // 메시지 attempt0
      .mockResolvedValueOnce(res({ ok: true, body: {} })); // 메시지 attempt1

    const r = await sendDiscordDM('discord-user-1', msg);
    expect(r).toMatchObject({ channel: 'discord', ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('토큰 미설정 → fetch 미호출, reason:error', async () => {
    mockEnv.DISCORD_BOT_TOKEN = '';
    expect(isDiscordBotEnabled()).toBe(false);

    const r = await sendDiscordDM('discord-user-1', msg);
    expect(r).toEqual({ channel: 'discord', ok: false, reason: 'error' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
