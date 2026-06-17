#!/usr/bin/env node
/**
 * make_cc 모더레이션 봇 (상시 실행).
 *  (1) AutoMod 차단 시 → 위반이 일어난 그 채널에 공개 사유 게시.
 *  (2) #일반 반복 문구 도배 감지 → 메시지 삭제 + 사유 게시.
 *      - 한 메시지 안에서 같은 구절 반복("AAA AAA AAA")
 *      - 같은 내용 여러 번 연속 전송(20초 내 3회+)
 *
 * 의존성 없음 (Node 21+ 글로벌 WebSocket).
 * ⚠️ 필요 권한/인텐트:
 *    - 봇에 Manage Server (AutoMod 이벤트 수신) + Manage Messages (메시지 삭제)
 *    - Developer Portal → Bot → Privileged Gateway Intents → "MESSAGE CONTENT INTENT" ON
 *
 *   node --env-file=.env scripts/discord-automod-relay.mjs
 * ⚠️ 상시 실행 프로세스: 떠 있는 동안만 작동. 24/7은 호스팅 필요.
 */
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const API = 'https://discord.com/api/v10';
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

// GUILD_MESSAGES(1<<9) | MESSAGE_CONTENT(1<<15) | AUTO_MODERATION_EXECUTION(1<<21)
const INTENTS = (1 << 9) | (1 << 15) | (1 << 21);

const REASON = { 1: '링크·금지어', 3: '스팸/도배', 4: '금지어(프리셋)', 5: '멘션 도배' };
const ruleNameCache = new Map();

// 반복 도배 감지 상태
const FLOOD_WINDOW_MS = 20_000;
const FLOOD_COUNT = 3;
const recent = new Map(); // userId -> [{ c, t, id }]
const lastWarn = new Map(); // userId -> ts

let ILBAN = null; // #일반 채널 id
let ADMIN_ROLE = null; // 운영자 역할 id

if (!TOKEN) { console.error('❌ DISCORD_BOT_TOKEN 미설정'); process.exit(1); }

const auth = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };

async function rest(method, path, body) {
  return fetch(`${API}${path}`, { method, headers: auth, body: body ? JSON.stringify(body) : undefined });
}

async function init() {
  const channels = await (await rest('GET', `/guilds/${GUILD}/channels`)).json();
  ILBAN = channels.find((c) => c.type === 0 && c.name.includes('일반'))?.id ?? null;
  const roles = await (await rest('GET', `/guilds/${GUILD}/roles`)).json();
  ADMIN_ROLE = roles.find((r) => r.name.includes('운영자'))?.id ?? null;
  console.log(`· 설정 로드: #일반=${ILBAN}, 운영자역할=${ADMIN_ROLE}`);
}

// ---- AutoMod 사유: 실제 규칙 이름 ----
async function reasonFor(d) {
  if (d.rule_id && ruleNameCache.has(d.rule_id)) return ruleNameCache.get(d.rule_id);
  if (d.rule_id) {
    try {
      const r = await rest('GET', `/guilds/${d.guild_id}/auto-moderation/rules/${d.rule_id}`);
      if (r.ok) { const name = (await r.json()).name; ruleNameCache.set(d.rule_id, name); return name; }
    } catch { /* ignore */ }
  }
  return REASON[d.rule_trigger_type] || '규칙 위반';
}

// ---- 반복 감지 ----
const norm = (s) => s.replace(/\s+/g, '').toLowerCase();

// 한 메시지가 같은 구절(2~20자)의 3회+ 반복으로 이뤄졌는가
function isRepeatedPhrase(text) {
  const s = norm(text);
  if (s.length < 12) return false;
  const maxP = Math.min(20, Math.floor(s.length / 3));
  for (let p = 2; p <= maxP; p++) {
    const unit = s.slice(0, p);
    let reps = 0;
    let ok = true;
    for (let i = 0; i < s.length; i += p) {
      if (s.substr(i, p) === unit) reps++;
      else { ok = false; break; }
    }
    if (ok && reps >= 3) return true;
  }
  return false;
}

async function warn(channelId, userId, reason) {
  await rest('POST', `/channels/${channelId}/messages`, {
    content: `🚫 <@${userId}>님의 메시지가 도배로 삭제됐어요.\n**사유:** ${reason}`,
    allowed_mentions: { parse: [] },
  }).catch(() => {});
}
const del = (channelId, msgId) => rest('DELETE', `/channels/${channelId}/messages/${msgId}`).catch(() => {});

async function onMessageCreate(d) {
  if (d.channel_id !== ILBAN) return; // #일반만
  if (!d.author || d.author.bot) return;
  if (ADMIN_ROLE && (d.member?.roles || []).includes(ADMIN_ROLE)) return; // 운영자 예외
  const content = d.content || '';
  if (!content) return;

  // (1) 한 메시지 내 반복
  if (isRepeatedPhrase(content)) {
    await del(d.channel_id, d.id);
    await warn(d.channel_id, d.author.id, '반복 문구 도배');
    return;
  }

  // (2) 같은 내용 연속 전송(20초 내 3회+)
  const now = Date.now();
  const c = norm(content);
  if (c.length < 2) return;
  const arr = (recent.get(d.author.id) || []).filter((e) => now - e.t < FLOOD_WINDOW_MS);
  arr.push({ c, t: now, id: d.id });
  recent.set(d.author.id, arr);
  const same = arr.filter((e) => e.c === c);
  if (same.length >= FLOOD_COUNT) {
    for (const e of same) await del(d.channel_id, e.id); // 버스트 전체 삭제
    recent.set(d.author.id, arr.filter((e) => e.c !== c));
    if (now - (lastWarn.get(d.author.id) || 0) > 8000) {
      await warn(d.channel_id, d.author.id, '같은 문구 반복 도배');
      lastWarn.set(d.author.id, now);
    }
  }
}

async function onAutoMod(d) {
  if (d.guild_id !== GUILD) return;
  if (d.action?.type !== 1 || !d.channel_id) return; // BLOCK_MESSAGE만
  const reason = await reasonFor(d);
  const snippet = d.content ? String(d.content).replace(/`/g, "'").slice(0, 120) : '';
  const lines = [`🚫 <@${d.user_id}>님의 메시지가 자동으로 삭제됐어요.`, `**사유:** ${reason}`];
  if (snippet) lines.push(`**내용:** \`${snippet}\``);
  await rest('POST', `/channels/${d.channel_id}/messages`, {
    content: lines.join('\n'),
    allowed_mentions: { parse: [] },
  }).then((r) => console.log(r.ok ? `· AutoMod 알림 (${reason})` : `· 게시 실패 ${r.status}`)).catch(() => {});
}

// ---- Gateway ----
let ws, hb, lastSeq = null;
function connect() {
  ws = new WebSocket(GATEWAY);
  ws.addEventListener('open', () => console.log('· gateway 연결'));
  ws.addEventListener('message', (ev) => onMessage(JSON.parse(ev.data)));
  ws.addEventListener('close', (e) => {
    clearInterval(hb);
    if (e.code === 4014) {
      console.error('❌ Disallowed intent — Developer Portal에서 "MESSAGE CONTENT INTENT"를 켜주세요. 재연결 중단.');
      return;
    }
    console.log(`· 연결 종료(${e.code}) — 5초 후 재연결`);
    setTimeout(connect, 5000);
  });
  ws.addEventListener('error', () => {});
}
function send(o) { ws.send(JSON.stringify(o)); }
function onMessage(p) {
  if (p.s != null) lastSeq = p.s;
  if (p.op === 10) {
    hb = setInterval(() => send({ op: 1, d: lastSeq }), p.d.heartbeat_interval);
    send({ op: 2, d: { token: TOKEN, intents: INTENTS, properties: { os: 'linux', browser: 'make_cc', device: 'make_cc' } } });
  } else if (p.op === 0) {
    if (p.t === 'READY') console.log(`✅ 로그인: ${p.d.user.username} — 감시 시작 (AutoMod + #일반 도배)`);
    else if (p.t === 'AUTO_MODERATION_ACTION_EXECUTION') onAutoMod(p.d);
    else if (p.t === 'MESSAGE_CREATE') onMessageCreate(p.d);
  }
}

await init();
connect();
console.log('모더레이션 봇 시작 (Ctrl+C로 종료)');
