// make_cc 노션 허브 v2 — 2026 트렌드(벤토 그리드·컬러 타일·볼드·비비드 그라데이션) 적용.
import fs from 'node:fs';
const TOKEN = (fs.readFileSync('.env', 'utf8').match(/^\s*NOTION_TOKEN\s*=\s*(.+)$/m) || [])[1]?.trim();
const H = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const api = (p, o = {}) => fetch(`https://api.notion.com/v1/${p}`, { headers: H, ...o }).then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json() }));
// 이전 허브/페이지 보관 (있으면)
const OLD = ['38f9b9c2-ef59-8148-92f3-c704551adfea', '38f9b9c2-ef59-817c-9bcd-d3e6c6885e7d'];

function rt(text) {
  const out = []; const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g; let last = 0, m;
  const push = (c, ann = {}, link = null) => { if (c) out.push({ type: 'text', text: { content: c, link: link ? { url: link } : null }, annotations: ann }); };
  while ((m = re.exec(text))) { push(text.slice(last, m.index)); if (m[2]) push(m[2], { bold: true }); else if (m[3]) push(m[3], { code: true }); else if (m[4]) push(m[4], {}, m[5]); last = re.lastIndex; }
  push(text.slice(last)); return out.length ? out : [{ type: 'text', text: { content: '' } }];
}
const P = (t) => ({ type: 'paragraph', paragraph: { rich_text: rt(t) } });
const BUL = (t) => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(t) } });
const TODO = (t) => ({ type: 'to_do', to_do: { checked: false, rich_text: rt(t) } });
const H1 = (t) => ({ type: 'heading_1', heading_1: { rich_text: rt(t) } });
const H2 = (t, color) => ({ type: 'heading_2', heading_2: { rich_text: rt(t), ...(color ? { color } : {}) } });
const DIV = () => ({ type: 'divider', divider: {} });
// 타일: 자식 없는 callout (멀티라인 rich_text + 이모지 아이콘) — 벤토 그리드 셀
const TILE = (emoji, color, text) => ({ type: 'callout', callout: { icon: { emoji }, color, rich_text: rt(text) } });
const CALL = (emoji, color, text, children) => ({ type: 'callout', callout: { icon: { emoji }, color, rich_text: rt(text), ...(children ? { children } : {}) } });
const TOG = (t, children) => ({ type: 'toggle', toggle: { rich_text: rt(t), children } });
const COLS = (...cols) => ({ type: 'column_list', column_list: { children: cols.map((c) => ({ type: 'column', column: { children: c } })) } });
const TABLE = (rows) => ({ type: 'table', table: { table_width: rows[0].length, has_column_header: true, has_row_header: false, children: rows.map((r) => ({ type: 'table_row', table_row: { cells: r.map((c) => rt(String(c))) } })) } });

const ROADMAP = [
  ['SRT 자동 생성 + 브라우저 편집기', '완료', '기능'], ['번인 자막 스튜디오 (프리셋·카라오케)', '완료', '기능'],
  ['화자 분리 (speaker diarization)', '완료', '기능'], ['다국어 번역 (DeepL · 영·일·중)', '완료', '기능'],
  ['자막 스타일 어시 (영상분석→추천)', '완료', '기능'], ['흑백 미니멀 재디자인 + 모바일 에디터', '완료', 'UI'],
  ['prod 배포 (밀린 커밋 vercel --prod)', '진행 중', '운영'], ['클라우드 워커(RunPod) 24/7 전환', '예정', '인프라'],
  ['수익화 방향 확정', '예정', '사업'], ['per-IP 레이트리밋 (어뷰징 방어)', '예정', '운영'], ['first-party 분석 (Supabase)', '예정', '기능'],
];

(async () => {
  for (const id of OLD) await api(`pages/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
  const s = await api('search', { method: 'POST', body: JSON.stringify({ filter: { property: 'object', value: 'page' }, page_size: 5 }) });
  const parent = (s.json.results || []).find((r) => r.object === 'page')?.id;
  if (!parent) { console.error('부모 페이지 없음'); process.exit(1); }

  const create = await api('pages', { method: 'POST', body: JSON.stringify({
    parent: { page_id: parent },
    icon: { type: 'emoji', emoji: '🎬' },
    cover: { type: 'external', external: { url: 'https://www.notion.so/images/page-cover/gradients_2.png' } },
    properties: { title: { title: rt('make_cc — 한국어 자막 자동생성') } },
    children: [
      // 히어로 (볼드 타이포 + 컬러 배너)
      CALL('🎬', 'orange_background', '**make_cc** — 한국어 영상 올리면 자동 자막 → 편집 → 번인 → 다국어 번역까지', [
        P('🟢 **운영 중**   ·   **v0.5.0**   ·   [makecc.vercel.app](https://makecc.vercel.app)'),
      ]),
      H2('📊 한눈에', 'orange'),
      // 벤토 KPI 그리드 (컬러 타일 4)
      COLS(
        [TILE('⚡', 'orange_background', '처리 속도\n**1분 → 30초**')],
        [TILE('🌐', 'blue_background', '자막 언어\n**4개국어**\n한·영·일·중')],
        [TILE('🎞️', 'purple_background', '지원 포맷\n**4종**\nMP4·MOV·MKV·WebM')],
        [TILE('💸', 'green_background', '게스트\n**완전 무료**')],
      ),
      // 벤토 정보 그리드 (컬러 타일 3)
      COLS(
        [TILE('🔗', 'gray_background', '**바로가기**\n[🌐 라이브 데모](https://makecc.vercel.app)\n[💻 GitHub](https://github.com/adll1151/make_cc)\n[🏷️ 릴리스](https://github.com/adll1151/make_cc/releases)')],
        [TILE('🚦', 'yellow_background', '**상태**\n🟢 운영 중 (prod)\n버전 v0.5.0\n솔로 개발')],
        [TILE('🛠️', 'pink_background', '**스택**\nNext.js 15 · Supabase\nWhisper large-v3 + pyannote\nffmpeg/libass · DeepL')],
      ),
      DIV(),
      H2('🗺️ 로드맵', 'blue'),
    ],
  }) });
  if (!create.ok) { console.error('페이지 생성 실패', create.status, JSON.stringify(create.json).slice(0, 500)); process.exit(1); }
  const page = create.json.id;
  console.log('허브 v2 ✅', create.json.url);

  const db = await api('databases', { method: 'POST', body: JSON.stringify({
    parent: { type: 'page_id', page_id: page }, title: rt('🗺️ 로드맵'),
    properties: {
      '항목': { title: {} },
      '상태': { select: { options: [{ name: '완료', color: 'green' }, { name: '진행 중', color: 'yellow' }, { name: '예정', color: 'gray' }] } },
      '분류': { select: { options: [{ name: '기능', color: 'blue' }, { name: '인프라', color: 'orange' }, { name: '운영', color: 'red' }, { name: '사업', color: 'purple' }, { name: 'UI', color: 'pink' }] } },
    },
  }) });
  if (db.ok) { let n = 0; for (const [item, st, cat] of ROADMAP) { const r = await api('pages', { method: 'POST', body: JSON.stringify({ parent: { database_id: db.json.id }, properties: { '항목': { title: rt(item) }, '상태': { select: { name: st } }, '분류': { select: { name: cat } } } }) }); if (r.ok) n++; } console.log(`로드맵 DB ✅ +${n}`); }
  else console.error('DB 실패', db.status, JSON.stringify(db.json).slice(0, 200));

  const ap = await api(`blocks/${page}/children`, { method: 'PATCH', body: JSON.stringify({ children: [
    P('💡 위 로드맵을 보드(칸반)로 보려면: DB 우측 상단 → 뷰 추가 → Board → 그룹화 "상태"'),
    DIV(),
    H2('🗓️ 변경 이력', 'purple'),
    TABLE([['버전', '날짜', '핵심'], ['v0.5.0', '2026-06-24', '자막 다국어 번역 (DeepL)'], ['v0.4.0', '2026-06-24', '재디자인 + 모션 + 모바일'], ['v0.3.0', '2026-06-20', '프로덕션 준비 · 카라오케'], ['v0.2.0', '2026-06-17', 'AdSense + 개인정보'], ['v0.1.0', '2026-06-17', '초기 릴리스']]),
    DIV(),
    TOG('🛠️ 기술 스택 (자세히)', [BUL('**프레임워크**: Next.js 15 (App Router) · TypeScript'), BUL('**인증/DB/스토리지**: Supabase (Auth·Postgres·Storage, RLS)'), BUL('**큐**: BullMQ + Redis (DB 폴링 폴백)'), BUL('**STT**: Whisper large-v3 (ko) + pyannote — GPU 워커'), BUL('**번인/번역**: ffmpeg + libass · DeepL'), BUL('**테스트**: Vitest 190개')]),
    TOG('📝 작업 로그 · 2026-06-30', [BUL('🐛 슬라이더 모바일 터치 드래그 버그 수정'), BUL('✨ 자막 스타일 어시 Tier1'), BUL('🚀 릴리스 v0.4.0·v0.5.0'), BUL('🌐 랜딩 다국어 섹션 + 지표 정직화'), BUL('🧰 사용량 CLI · 노션 연동')]),
    CALL('⚠️', 'red_background', '**열린 이슈 / 다음**', [TODO('prod 배포 (vercel --prod)'), TODO('클라우드 워커(RunPod) 24/7'), TODO('per-IP 레이트리밋'), TODO('수익화 방향 + 가격 페이지')]),
  ] }) });
  if (!ap.ok) console.error('append 실패', ap.status, JSON.stringify(ap.json).slice(0, 300));
  console.log('\n완료 → ' + create.json.url);
})();
