import { env } from '@/lib/env';
import { logger, type Logger } from '@/lib/logger';
import type { NotifyResult } from '@/types/user';

/**
 * Discord 봇 DM 발송 — REST API v10 (Gateway 미상주, `fetch`만 사용).
 *
 * 2-step:
 *   1) POST /users/@me/channels  { recipient_id } → DM 채널 개설
 *   2) POST /channels/{id}/messages { embeds }    → 메시지 전송
 *
 * 실패 처리:
 *   - 429 → retry-after backoff (최대 3회)
 *   - 403 + code 50007 → 'blocked' (사용자 privacy 차단)
 *   - 그 외 → 'error'
 *
 * 참조: docs/02-design/features/discord-integration.design.md §4.4
 */

const API = 'https://discord.com/api/v10';
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 10_000;

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

export interface DiscordMessage {
  embed: DiscordEmbed;
}

export function isDiscordBotEnabled(): boolean {
  return env.DISCORD_BOT_TOKEN.length > 0;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function sendDiscordDM(
  discordUserId: string,
  message: DiscordMessage,
): Promise<NotifyResult> {
  const log = logger.child({ notify: 'discord', discordUserId });

  if (!isDiscordBotEnabled()) {
    log.info('skip — DISCORD_BOT_TOKEN 미설정');
    return { channel: 'discord', ok: false, reason: 'error' };
  }

  // 1) DM 채널 개설
  const channel = await post(`${API}/users/@me/channels`, { recipient_id: discordUserId }, log);
  if (!channel.ok) return channel.result;
  const channelId = (channel.body as { id?: string })?.id;
  if (!channelId) {
    log.error('discord DM 채널 id 누락');
    return { channel: 'discord', ok: false, reason: 'error' };
  }

  // 2) 메시지 전송
  const sent = await post(`${API}/channels/${channelId}/messages`, { embeds: [message.embed] }, log);
  if (!sent.ok) return sent.result;

  log.info('discord DM sent');
  return { channel: 'discord', ok: true };
}

interface PostOutcome {
  ok: boolean;
  body?: unknown;
  result: NotifyResult;
}

async function post(url: string, payload: unknown, log: Logger): Promise<PostOutcome> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
    } catch (err) {
      log.error({ err: (err as Error)?.message }, 'discord fetch threw');
      return fail('error');
    }

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: true, body, result: { channel: 'discord', ok: true } };
    }

    // rate limit → backoff 후 재시도
    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const waitMs = await readRetryAfter(res);
        log.warn({ waitMs, attempt }, 'discord 429 — backoff');
        await sleep(waitMs);
        continue;
      }
      log.error('discord 429 — 재시도 초과');
      return fail('rate_limited');
    }

    // privacy 차단 (Cannot send messages to this user)
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { code?: number };
      if (body?.code === 50007) {
        log.info('discord 50007 — DM 차단됨');
        return fail('blocked');
      }
    }

    log.error({ status: res.status }, 'discord send failed');
    return fail('error');
  }
  return fail('rate_limited');
}

function fail(reason: NotifyResult['reason']): PostOutcome {
  return { ok: false, result: { channel: 'discord', ok: false, reason } };
}

async function readRetryAfter(res: Response): Promise<number> {
  const header = res.headers.get('retry-after');
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n)) return Math.min(n * 1000, MAX_BACKOFF_MS);
  }
  const body = (await res.clone().json().catch(() => ({}))) as { retry_after?: number };
  if (typeof body?.retry_after === 'number') return Math.min(body.retry_after * 1000, MAX_BACKOFF_MS);
  return 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
