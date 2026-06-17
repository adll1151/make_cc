#!/usr/bin/env node
/**
 * Discord 서버 커스터마이즈 (일회성) — 역할 색·이모지, 서버 이름, 최고 관리자 지정.
 * 각 단계는 독립적으로 try/catch — 일부 실패해도 나머지는 진행하고 결과를 보고한다.
 *
 *   node scripts/discord-customize.mjs            # 시도(실제 변경) + 결과 보고
 */

const API = 'https://discord.com/api/v10';
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;

const GUILD_NAME = 'make_cc · 한국어 자막 CC';
const ADMIN_MEMBER_QUERY = '농장데몬헌터';

const ADMINISTRATOR = (1n << 3n).toString();

// 역할: 이모지 prefix + 색
const ROLE_STYLE = {
  운영자: { name: '👑 운영자', color: 0xf1c40f }, // gold
  회원: { name: '✨ 회원', color: 0xa060ff }, // 브랜드 퍼플
  손님: { name: '👋 손님', color: 0x99aab5 }, // grey
};

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
const fail = (m, e) => console.log(`  ❌ ${m} — ${e.message}`);

async function main() {
  if (!TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN 미설정');
    process.exit(1);
  }

  const roles = await api('GET', `/guilds/${GUILD}/roles`);
  const byName = (n) => roles.find((r) => r.name === n || r.name.endsWith(n));

  // 1) 역할 색·이모지
  console.log('\n● 역할 색·이모지');
  for (const [base, style] of Object.entries(ROLE_STYLE)) {
    const role = byName(base);
    if (!role) {
      console.log(`  · ${base} 역할 없음 (skip)`);
      continue;
    }
    try {
      await api('PATCH', `/guilds/${GUILD}/roles/${role.id}`, { name: style.name, color: style.color });
      ok(`${style.name}  (#${style.color.toString(16)})`);
    } catch (e) {
      fail(`${base} 업데이트`, e);
    }
  }

  // 2) 서버 이름
  console.log('\n● 서버 이름');
  try {
    await api('PATCH', `/guilds/${GUILD}`, { name: GUILD_NAME });
    ok(`"${GUILD_NAME}" 로 변경`);
  } catch (e) {
    fail('서버 이름 변경 (Manage Guild 권한 필요)', e);
  }

  // 3) 최고 관리자 지정
  console.log('\n● 최고 관리자 지정 — ' + ADMIN_MEMBER_QUERY);
  let member = null;
  try {
    const found = await api(
      'GET',
      `/guilds/${GUILD}/members/search?query=${encodeURIComponent(ADMIN_MEMBER_QUERY)}&limit=5`,
    );
    member =
      found.find(
        (m) =>
          m.user?.username === ADMIN_MEMBER_QUERY ||
          m.nick === ADMIN_MEMBER_QUERY ||
          m.user?.global_name === ADMIN_MEMBER_QUERY,
      ) || found[0];
    if (member) ok(`멤버 찾음: ${member.user?.global_name ?? member.user?.username} (${member.user?.id})`);
    else console.log('  · 검색 결과 없음');
  } catch (e) {
    fail('멤버 검색 (Server Members Intent 필요할 수 있음)', e);
  }

  const adminRole = byName('운영자');
  if (member && adminRole) {
    // 3a) 운영자 역할에 관리자 권한 부여 시도
    try {
      await api('PATCH', `/guilds/${GUILD}/roles/${adminRole.id}`, { permissions: ADMINISTRATOR });
      ok('운영자 역할에 관리자 권한 부여');
    } catch (e) {
      fail('운영자 역할에 관리자 권한 (봇이 Administrator 없으면 불가)', e);
    }
    // 3b) 멤버에게 운영자 역할 부여
    try {
      await api('PUT', `/guilds/${GUILD}/members/${member.user.id}/roles/${adminRole.id}`);
      ok(`${ADMIN_MEMBER_QUERY} 에게 운영자 역할 부여`);
    } catch (e) {
      fail(`${ADMIN_MEMBER_QUERY} 역할 부여`, e);
    }
  }

  console.log('\n완료 — 위 결과를 확인하세요.');
}

main().catch((e) => {
  console.error('치명적 오류:', e.message);
  process.exit(1);
});
