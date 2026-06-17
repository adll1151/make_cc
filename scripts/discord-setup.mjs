#!/usr/bin/env node
/**
 * Discord 서버 셋업 — Option C (Pragmatic Balance) 구조를 REST API로 생성.
 *
 * 설계: docs/operations/discord-setup.md / discord-integration.design.md §7.5
 *
 * 사용법:
 *   node --env-file=.env scripts/discord-setup.mjs            # dry-run (계획만 출력)
 *   node --env-file=.env scripts/discord-setup.mjs --apply    # 실제 생성
 *
 * 환경변수:
 *   DISCORD_BOT_TOKEN  (필수)  봇 토큰. 봇은 서버에 Manage Channels + Manage Roles 권한으로 초대돼 있어야 함.
 *   DISCORD_GUILD_ID   (선택)  대상 서버 id. 없으면 INVITE_CODE로 해석.
 *
 * 특성:
 *   - create-only: 같은 이름의 역할/채널이 이미 있으면 건너뜀. 기존 채널을 삭제하지 않음.
 *   - 429 rate limit 시 retry-after 만큼 대기 후 재시도.
 */

const API = 'https://discord.com/api/v10';
const INVITE_CODE = 'D6hrNbYK9'; // https://discord.gg/D6hrNbYK9
const APPLY = process.argv.includes('--apply');
const TOKEN = process.env.DISCORD_BOT_TOKEN;

// 권한 비트
const PERM = {
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
};
const CHANNEL = { CATEGORY: 4, TEXT: 0 };
const OVERWRITE = { ROLE: 0, MEMBER: 1 };

// ----- 적용할 구조 -----
// 역할은 라벨로만 생성 (권한 0). 봇이 자기가 없는 권한을 가진 역할을 만들 수 없으므로(50013),
// 운영자 관리자 권한은 서버 소유자가 생성 후 수동 부여한다 — 최소권한 유지.
const ROLES = [
  { name: '운영자', color: 0xe0a0ff, hoist: true, permissions: '0' },
  { name: '회원', color: 0x57f287, hoist: true, permissions: '0' },
  { name: '손님', color: 0x99aab5, hoist: false, permissions: '0' },
];

const STRUCTURE = [
  { category: '📌 시작하기', channels: [{ name: '환영-규칙', readonly: true }] },
  {
    category: '📣 공지',
    channels: [
      { name: '공지사항', readonly: true },
      { name: '업데이트', readonly: true },
    ],
  },
  {
    category: '💬 커뮤니티',
    channels: [{ name: '일반' }, { name: '자막-자랑' }, { name: '피드백-제안' }],
  },
  { category: '🛟 지원', channels: [{ name: '문의' }, { name: '버그-신고' }] },
  { category: '🤖 비공개', channels: [{ name: '봇-로그', private: true }] },
];

// ----- HTTP -----
async function discord(method, path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const wait = Math.min((data.retry_after ?? 1) * 1000, 10_000);
      console.log(`  · rate limited, ${wait}ms 대기...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status} ${text}`);
    }
    return res.status === 204 ? null : res.json();
  }
  throw new Error(`${method} ${path} → 429 재시도 초과`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveGuildId() {
  if (process.env.DISCORD_GUILD_ID) return process.env.DISCORD_GUILD_ID;
  const inv = await fetch(`${API}/invites/${INVITE_CODE}?with_counts=true`).then((r) => r.json());
  if (!inv?.guild?.id) throw new Error(`초대 코드 ${INVITE_CODE}로 guild를 찾지 못함. DISCORD_GUILD_ID를 .env에 지정하세요.`);
  return inv.guild.id;
}

// ----- main -----
async function main() {
  if (!TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN 미설정. .env에 봇 토큰을 넣고 다시 실행하세요.');
    process.exit(1);
  }

  console.log(APPLY ? '🚀 APPLY 모드 — 실제로 생성합니다.\n' : '🔎 DRY-RUN — 계획만 출력합니다 (--apply로 실제 생성).\n');

  const guildId = await resolveGuildId();
  const me = await discord('GET', '/users/@me');
  console.log(`서버: ${guildId}   봇: ${me.username} (${me.id})\n`);

  // 기존 역할/채널 로드 (중복 생성 방지)
  const existingRoles = await discord('GET', `/guilds/${guildId}/roles`);
  const existingChannels = await discord('GET', `/guilds/${guildId}/channels`);
  const roleByName = new Map(existingRoles.map((r) => [r.name, r]));
  const chanKey = (name, type) => `${type}:${name.toLowerCase().replace(/\s+/g, '-')}`;
  const existingChanKeys = new Set(existingChannels.map((c) => chanKey(c.name, c.type)));

  // 1) 역할
  console.log('● 역할');
  for (const role of ROLES) {
    if (roleByName.has(role.name)) {
      console.log(`  = ${role.name} (이미 있음, skip)`);
      continue;
    }
    if (!APPLY) {
      console.log(`  + ${role.name} (생성 예정)`);
      continue;
    }
    const created = await discord('POST', `/guilds/${guildId}/roles`, role);
    roleByName.set(role.name, created);
    console.log(`  + ${role.name} 생성됨`);
    await sleep(300);
  }
  const adminRole = roleByName.get('운영자');

  // 2) 카테고리 + 채널
  for (const group of STRUCTURE) {
    console.log(`\n● ${group.category}`);
    let parentId = existingChannels.find(
      (c) => c.type === CHANNEL.CATEGORY && c.name === group.category,
    )?.id;

    if (!parentId) {
      if (!APPLY) {
        console.log(`  + [카테고리] ${group.category} (생성 예정)`);
      } else {
        const cat = await discord('POST', `/guilds/${guildId}/channels`, {
          name: group.category,
          type: CHANNEL.CATEGORY,
        });
        parentId = cat.id;
        console.log(`  + [카테고리] ${group.category} 생성됨`);
        await sleep(300);
      }
    } else {
      console.log(`  = [카테고리] ${group.category} (이미 있음)`);
    }

    for (const ch of group.channels) {
      if (existingChanKeys.has(chanKey(ch.name, CHANNEL.TEXT))) {
        console.log(`    = ${ch.name} (이미 있음, skip)`);
        continue;
      }
      const overwrites = buildOverwrites(ch, guildId, adminRole, me.id);
      const tag = ch.readonly ? ' [읽기전용]' : ch.private ? ' [비공개]' : '';
      if (!APPLY) {
        console.log(`    + ${ch.name}${tag} (생성 예정)`);
        continue;
      }
      await discord('POST', `/guilds/${guildId}/channels`, {
        name: ch.name,
        type: CHANNEL.TEXT,
        parent_id: parentId,
        permission_overwrites: overwrites,
      });
      console.log(`    + ${ch.name}${tag} 생성됨`);
      await sleep(300);
    }
  }

  console.log(
    APPLY
      ? '\n✅ 완료. 서버에서 결과를 확인하고, 기존 불필요 채널은 직접 정리하세요.'
      : '\n검토 후 실제 적용: node --env-file=.env scripts/discord-setup.mjs --apply',
  );
}

function buildOverwrites(ch, guildId, adminRole, botId) {
  if (ch.readonly) {
    // @everyone 메시지 보내기 거부
    return [{ id: guildId, type: OVERWRITE.ROLE, deny: PERM.SEND_MESSAGES.toString() }];
  }
  if (ch.private) {
    const allow = (PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES).toString();
    const list = [
      { id: guildId, type: OVERWRITE.ROLE, deny: PERM.VIEW_CHANNEL.toString() },
      { id: botId, type: OVERWRITE.MEMBER, allow },
    ];
    if (adminRole) list.push({ id: adminRole.id, type: OVERWRITE.ROLE, allow });
    return list;
  }
  return [];
}

main().catch((err) => {
  console.error('\n❌ 실패:', err.message);
  process.exit(1);
});
