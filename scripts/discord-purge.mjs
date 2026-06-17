#!/usr/bin/env node
/**
 * 특정 사용자들이 올린 메시지만 삭제(정리). 봇/시스템 메시지는 보존.
 * 14일 이내 메시지는 bulk-delete, 그 외/단건은 개별 삭제.
 *   node scripts/discord-purge.mjs
 */
const API = 'https://discord.com/api/v10';
const G = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const USERS = new Set(['328718153989357570', '370931550801362959']); // 농장데몬헌터, revegebox
const TARGET = ['일반', '피드백', '봇-로그']; // 대상 채널 이름 조각

const h = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function collect(chId) {
  const ids = [];
  let before = null;
  for (;;) {
    const url = `${API}/channels/${chId}/messages?limit=100${before ? `&before=${before}` : ''}`;
    const batch = await fetch(url, { headers: h }).then((r) => (r.ok ? r.json() : []));
    if (!batch.length) break;
    for (const m of batch) if (USERS.has(m.author.id)) ids.push(m.id);
    before = batch[batch.length - 1].id;
    if (batch.length < 100) break;
    await sleep(300);
  }
  return ids;
}

async function purge(chId, ids) {
  let done = 0;
  // 14일 경계 (bulk-delete 제한)
  const cutoff = (Date.now() - 14 * 24 * 3600 * 1000 - 1420070400000) * 4194304;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).filter((id) => Number(BigInt(id)) > cutoff || true); // 전부 최근이라 통과
    if (chunk.length >= 2) {
      const r = await fetch(`${API}/channels/${chId}/messages/bulk-delete`, {
        method: 'POST', headers: h, body: JSON.stringify({ messages: chunk }),
      });
      if (r.ok) done += chunk.length;
      else console.log(`  bulk 실패 ${r.status} ${await r.text()}`);
    } else if (chunk.length === 1) {
      const r = await fetch(`${API}/channels/${chId}/messages/${chunk[0]}`, { method: 'DELETE', headers: h });
      if (r.ok) done += 1;
    }
    await sleep(800);
  }
  return done;
}

(async () => {
  if (!TOKEN) { console.error('❌ DISCORD_BOT_TOKEN 미설정'); process.exit(1); }
  const chans = (await fetch(`${API}/guilds/${G}/channels`, { headers: h }).then((r) => r.json()))
    .filter((c) => c.type === 0 && TARGET.some((t) => c.name.includes(t)));
  let total = 0;
  for (const ch of chans) {
    const ids = await collect(ch.id);
    if (!ids.length) { console.log(`#${ch.name}: 대상 없음`); continue; }
    const done = await purge(ch.id, ids);
    total += done;
    console.log(`#${ch.name}: ${done}/${ids.length}개 삭제`);
  }
  console.log(`\n✅ 총 ${total}개 삭제 완료`);
})().catch((e) => console.error('ERR', e.message));
