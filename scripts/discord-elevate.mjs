#!/usr/bin/env node
/**
 * Discord 관리자급 일괄 설정 (봇에 Administrator 권한 부여된 상태에서 실행).
 * 각 단계 독립 try/catch — 일부 실패해도 나머지 진행 + 결과 보고.
 *
 *   node scripts/discord-elevate.mjs
 */

const API = 'https://discord.com/api/v10';
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;

const GUILD_NAME = 'make_cc · 한국어 자막 CC';
const RULES = [
  '서로 존중 — 비방·차별·괴롭힘 금지',
  '스팸·광고·도배 금지',
  '자막/영상 공유 시 본인 저작권 확인',
  '문의 → #문의 · 버그 → #버그-신고 · 제안 → #피드백-제안',
  '운영진 안내 따르기',
];

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
  if (!TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN 미설정');
    process.exit(1);
  }

  const guild = await api('GET', `/guilds/${GUILD}`);
  const channels = await api('GET', `/guilds/${GUILD}/channels`);
  const roles = await api('GET', `/guilds/${GUILD}/roles`);
  const chan = (frag) => channels.find((c) => c.type === 0 && c.name.includes(frag));
  const rulesCh = chan('환영');
  const updatesCh = chan('봇-로그') || chan('봇로그') || chan('공지');
  const adminRole = roles.find((r) => r.name.includes('운영자'));

  // 1) 서버 이름
  console.log('\n● 서버 이름');
  try {
    await api('PATCH', `/guilds/${GUILD}`, { name: GUILD_NAME });
    ok(`"${GUILD_NAME}"`);
  } catch (e) {
    bad('서버 이름', e);
  }

  // 2) 커뮤니티 활성화
  console.log('\n● 커뮤니티 활성화');
  try {
    const features = Array.from(new Set([...(guild.features || []), 'COMMUNITY']));
    await api('PATCH', `/guilds/${GUILD}`, {
      features,
      rules_channel_id: rulesCh?.id ?? null,
      public_updates_channel_id: updatesCh?.id ?? null,
      verification_level: 2, // MEDIUM
      explicit_content_filter: 2, // ALL_MEMBERS
      default_message_notifications: 1, // ONLY_MENTIONS (커뮤니티 요구)
    });
    ok(`COMMUNITY 켜짐 (규칙=#${rulesCh?.name}, 업데이트=#${updatesCh?.name})`);
  } catch (e) {
    bad('커뮤니티 활성화', e);
  }

  // 3) 멤버 심사(규칙 동의) — Community 활성 직후
  console.log('\n● 멤버 심사(규칙 동의)');
  try {
    await api('PATCH', `/guilds/${GUILD}/member-verification`, {
      enabled: true,
      description: 'make_cc 커뮤니티 규칙입니다. 동의하면 모든 채널이 열립니다.',
      form_fields: [
        { field_type: 'TERMS', label: '아래 규칙을 모두 읽고 동의합니다', required: true, values: RULES },
      ],
    });
    ok('규칙 동의 게이트 ON');
  } catch (e) {
    bad('멤버 심사 (Community 활성 직후 재시도 필요할 수 있음)', e);
  }

  // 4) 운영자 역할 → 관리자 권한
  console.log('\n● 운영자 역할 관리자 권한');
  if (adminRole) {
    try {
      await api('PATCH', `/guilds/${GUILD}/roles/${adminRole.id}`, { permissions: (1n << 3n).toString() });
      ok(`${adminRole.name} 관리자 권한 부여`);
    } catch (e) {
      bad('운영자 관리자 권한', e);
    }
  } else {
    console.log('  · 운영자 역할 없음 (skip)');
  }

  // 5) 환영 메시지 고정
  console.log('\n● 환영 메시지 고정');
  if (rulesCh) {
    try {
      const msgs = await api('GET', `/channels/${rulesCh.id}/messages?limit=20`);
      const welcome = msgs.find((m) => m.content?.startsWith('# 👋'));
      if (!welcome) throw new Error('환영 메시지를 못 찾음');
      await api('PUT', `/channels/${rulesCh.id}/pins/${welcome.id}`);
      ok('환영 메시지 고정');
    } catch (e) {
      bad('고정', e);
    }
  }

  console.log('\n완료 — 결과 확인 후, 보안을 위해 봇의 Administrator 권한을 다시 끄세요.');
}

main().catch((e) => {
  console.error('치명적 오류:', e.message);
  process.exit(1);
});
