#!/usr/bin/env node
/**
 * Discord 서버 꾸미기 — 부족한 채널 추가 + 전 채널 topic + 서버 소개 + 안내 메시지 + 온보딩.
 * 봇 Administrator 권한 상태에서 실행. 각 단계 독립 try/catch.
 *
 *   node scripts/discord-decorate.mjs
 */

const API = 'https://discord.com/api/v10';
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const DENY_SEND = (1n << 11n).toString(); // SEND_MESSAGES

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 채널 topic (이름 조각 → 설명)
const TOPICS = {
  '환영': 'make_cc 커뮤니티 규칙 + 시작 안내. 규칙에 동의하면 모든 채널이 열립니다.',
  '자기소개': '가볍게 인사해요 — 닉네임, 어떤 영상에 자막을 다는지, make_cc를 알게 된 계기',
  '공지사항': 'make_cc 공식 공지 (운영자 전용)',
  '업데이트': '새 기능 · 개선 · 릴리스 노트',
  '서비스-상태': '점검 · 장애 · 복구 안내. 서비스가 이상하면 먼저 여기를 확인하세요.',
  '사용법': 'make_cc 사용법, 자주 묻는 질문(FAQ), 유용한 링크',
  '일반': '자유로운 잡담 공간',
  '자막-자랑': 'make_cc로 만든 자막 · 영상 결과물을 자랑해요',
  '피드백': '원하는 기능 · 개선 아이디어를 남겨주세요',
  '문의': '사용 중 궁금한 점 · 도움 요청 (Q&A)',
  '버그': '버그 제보 — 재현 방법 · 스크린샷과 함께',
  '봇-로그': '봇 알림 발송 로그 (운영자 전용)',
};

// 새 채널 (없으면 생성)
const NEW = [
  { name: '서비스-상태', category: '📣 공지', readonly: true, seed: `# 🟢 서비스 상태

현재 **make_cc는 정상 운영 중**입니다.

점검·장애가 발생하면 이 채널에 안내합니다. 서비스가 느리거나 작동하지 않을 때 먼저 여기를 확인해주세요.` },
  { name: '사용법-faq', category: '📌 시작하기', readonly: true, seed: `# 📖 make_cc 사용법 & FAQ

## 빠른 시작
1. make_cc 웹사이트에서 한국어 영상 업로드
2. 자동으로 자막(SRT·CC) 생성 — 완료되면 Discord DM 또는 이메일로 알림
3. 편집기에서 미리보기·수정 → SRT 다운로드 또는 공유 링크 생성

## 자주 묻는 질문
**Q. 자막은 어떤 형식인가요?**
표준 SRT(폐쇄형 자막, CC)예요. 영상에 박히지 않고 켜고/끌 수 있습니다.

**Q. 업로드한 영상은 안전한가요?**
학습에 사용되지 않으며 일정 기간 후 자동 삭제됩니다.

**Q. 알림을 Discord DM으로 받고 싶어요.**
마이페이지에서 Discord 계정을 연결하면 잡 완료 시 DM으로 알려드려요. (이 서버에 참여해 있어야 봇이 DM을 보낼 수 있습니다.)

궁금한 점은 **#문의** 채널에 남겨주세요!` },
  { name: '자기소개', category: '💬 커뮤니티', readonly: false },
];

async function main() {
  if (!TOKEN) { console.error('❌ DISCORD_BOT_TOKEN 미설정'); process.exit(1); }

  let channels = await api('GET', `/guilds/${GUILD}/channels`);
  const catId = (name) => channels.find((c) => c.type === 4 && c.name === name)?.id;
  const findText = (frag) => channels.find((c) => c.type === 0 && c.name.includes(frag));

  // 1) 새 채널
  console.log('\n● 새 채널');
  for (const ch of NEW) {
    if (findText(ch.name)) { console.log(`  = #${ch.name} (이미 있음)`); continue; }
    try {
      const created = await api('POST', `/guilds/${GUILD}/channels`, {
        name: ch.name,
        type: 0,
        parent_id: catId(ch.category) ?? null,
        topic: TOPICS[ch.name] ?? TOPICS[ch.name.split('-')[0]] ?? undefined,
        permission_overwrites: ch.readonly ? [{ id: GUILD, type: 0, deny: DENY_SEND }] : [],
      });
      channels.push(created);
      ok(`#${ch.name} 생성${ch.readonly ? ' (읽기전용)' : ''}`);
      if (ch.seed) {
        await api('POST', `/channels/${created.id}/messages`, { content: ch.seed });
        ok(`  ↳ 안내 메시지 게시`);
      }
      await sleep(300);
    } catch (e) { bad(`#${ch.name} 생성`, e); }
  }

  // 2) 전 채널 topic
  console.log('\n● 채널 설명(topic)');
  for (const c of channels.filter((c) => c.type === 0)) {
    const key = Object.keys(TOPICS).find((k) => c.name.includes(k));
    if (!key) continue;
    if (c.topic === TOPICS[key]) { continue; }
    try {
      await api('PATCH', `/channels/${c.id}`, { topic: TOPICS[key] });
      ok(`#${c.name}`);
      await sleep(200);
    } catch (e) { bad(`#${c.name} topic`, e); }
  }

  // 3) 서버 소개
  console.log('\n● 서버 소개');
  try {
    await api('PATCH', `/guilds/${GUILD}`, {
      description: '한국어 영상에 자동으로 자막(CC)을 만들어주는 make_cc 공식 커뮤니티. 공지·업데이트·문의·피드백 환영!',
    });
    ok('description 설정');
  } catch (e) { bad('서버 소개', e); }

  // 4) 온보딩 (기본 채널 + 활성화)
  console.log('\n● 온보딩(서버 가이드)');
  try {
    const publicText = channels.filter((c) => c.type === 0 && !c.name.includes('봇-로그'));
    await api('PUT', `/guilds/${GUILD}/onboarding`, {
      default_channel_ids: publicText.map((c) => c.id),
      prompts: [],
      enabled: true,
      mode: 1, // ONBOARDING_ADVANCED (기본 채널 노출)
    });
    ok('온보딩 활성화');
  } catch (e) { bad('온보딩 (수동 설정 필요할 수 있음)', e); }

  console.log('\n완료 — 서버에서 확인하세요.');
}

main().catch((e) => { console.error('치명적 오류:', e.message); process.exit(1); });
