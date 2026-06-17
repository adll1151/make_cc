#!/usr/bin/env node
/**
 * Discord 모더레이션 설정 — 채널 삭제 + 이미지/링크/도배 차단 + AutoMod 알림.
 * 봇 Administrator 권한 상태에서 실행. 각 단계 독립 try/catch.
 *
 *   node scripts/discord-moderation.mjs
 */
const API = 'https://discord.com/api/v10';
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;

const EMBED_LINKS = 1n << 14n;
const ATTACH_FILES = 1n << 15n;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const d = await res.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, Math.min((d.retry_after ?? 1) * 1000, 8000)));
    return api(method, path, body);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m, e) => console.log(`  ❌ ${m} — ${e.message}`);

async function main() {
  if (!TOKEN) { console.error('❌ DISCORD_BOT_TOKEN 미설정'); process.exit(1); }

  const channels = await api('GET', `/guilds/${GUILD}/channels`);
  const roles = await api('GET', `/guilds/${GUILD}/roles`);
  const text = (frag) => channels.find((c) => c.type === 0 && c.name.includes(frag));
  const adminRole = roles.find((r) => r.name.includes('운영자'));
  const botRole = roles.find((r) => r.name === 'make_cc_bot');
  const botLog = text('봇-로그');
  const exempt = [adminRole?.id, botRole?.id].filter(Boolean);

  // 1) 채널 삭제
  console.log('\n● 채널 삭제');
  for (const name of ['자기소개', '자막-자랑']) {
    const ch = text(name);
    if (!ch) { console.log(`  · #${name} 없음`); continue; }
    try { await api('DELETE', `/channels/${ch.id}`); ok(`#${name} 삭제`); }
    catch (e) { bad(`#${name} 삭제`, e); }
  }

  // 2) @everyone: 이미지/파일 + 링크 미리보기 차단 (서버 전역)
  console.log('\n● 이미지/파일 업로드 차단 (@everyone)');
  try {
    const everyone = roles.find((r) => r.id === GUILD);
    const cur = BigInt(everyone.permissions);
    const next = (cur & ~ATTACH_FILES & ~EMBED_LINKS).toString();
    await api('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, { permissions: next });
    ok('Attach Files + Embed Links 제거 (운영자·봇은 관리자라 예외)');
  } catch (e) { bad('@everyone 권한', e); }

  // 3) #일반 슬로우모드 (도배 완화)
  console.log('\n● #일반 슬로우모드');
  const ilban = text('일반');
  if (ilban) {
    try { await api('PATCH', `/channels/${ilban.id}`, { rate_limit_per_user: 5 }); ok('5초 슬로우모드'); }
    catch (e) { bad('슬로우모드', e); }
  }

  // 4) AutoMod 규칙
  const alert = botLog ? [{ type: 2, metadata: { channel_id: botLog.id } }] : [];
  const rules = [
    {
      name: '링크 차단',
      event_type: 1,
      trigger_type: 1, // KEYWORD
      trigger_metadata: {
        regex_patterns: [
          'https?://',
          'www\\.',
          'discord\\.(gg|com/invite)/',
          '\\w+\\.(com|net|org|io|gg|kr|co|me|tv|app|dev|xyz|link|site)',
        ],
        keyword_filter: [],
      },
      actions: [{ type: 1, metadata: { custom_message: '링크는 올릴 수 없어요. 필요하면 운영진에게 문의해주세요.' } }, ...alert],
      enabled: true,
      exempt_roles: exempt,
      exempt_channels: [],
    },
    {
      name: '스팸/도배 차단',
      event_type: 1,
      trigger_type: 3, // SPAM (내장)
      actions: [{ type: 1, metadata: { custom_message: '스팸/도배로 감지되어 차단됐어요.' } }, ...alert],
      enabled: true,
      exempt_roles: exempt,
      exempt_channels: [],
    },
    {
      name: '멘션 도배 차단',
      event_type: 1,
      trigger_type: 5, // MENTION_SPAM
      trigger_metadata: { mention_total_limit: 5 },
      actions: [{ type: 1, metadata: { custom_message: '한 번에 너무 많은 멘션은 차단돼요.' } }, ...alert],
      enabled: true,
      exempt_roles: exempt,
      exempt_channels: [],
    },
  ];

  console.log('\n● AutoMod 규칙' + (botLog ? ` (알림 → #${botLog.name})` : ' (알림 채널 없음)'));
  const existing = await api('GET', `/guilds/${GUILD}/auto-moderation/rules`).catch(() => []);
  for (const rule of rules) {
    if (existing.find((r) => r.name === rule.name)) { console.log(`  = ${rule.name} (이미 있음)`); continue; }
    try { await api('POST', `/guilds/${GUILD}/auto-moderation/rules`, rule); ok(rule.name); }
    catch (e) { bad(rule.name, e); }
  }

  console.log('\n완료.');
}
main().catch((e) => { console.error('치명적 오류:', e.message); process.exit(1); });
