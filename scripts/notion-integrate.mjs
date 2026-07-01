// make_cc 를 기존 노션 "프로젝트/작업" 템플릿에 통합.
// - 프로젝트 DB에 make_cc 항목 생성(본문=프로젝트 문서)
// - 작업 DB에 로드맵 항목을 작업으로 생성(프로젝트에 연결)
// - 제목으로 중복 체크(재실행 안전). 정보 DB는 건드리지 않음.
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const TOKEN = (env.match(/^\s*NOTION_TOKEN\s*=\s*(.+)$/m) || [])[1]?.trim();
const H = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const api = (p, o = {}) => fetch(`https://api.notion.com/v1/${p}`, { headers: H, ...o }).then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json() }));

const DB_PROJECT = 'a1d62a2a-cf88-43c5-bfe3-ef2ed8200d16';
const DB_TASK = '0eb4a686-64be-4886-bd27-5b204959b6f3';
const OLD_PAGE = '38f9b9c2-ef59-817c-9bcd-d3e6c6885e7d'; // 잘못된 위치의 단독 페이지 → 보관

// ---- 인라인 마크다운 → rich_text ----
function rich(text) {
  const out = []; const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g; let last = 0, m;
  const push = (c, ann = {}, link = null) => { if (c) out.push({ type: 'text', text: { content: c, link: link ? { url: link } : null }, annotations: ann }); };
  while ((m = re.exec(text))) { push(text.slice(last, m.index)); if (m[2]) push(m[2], { bold: true }); else if (m[3]) push(m[3], { code: true }); else if (m[4]) push(m[4], {}, m[5]); last = re.lastIndex; }
  push(text.slice(last)); return out.length ? out : [{ type: 'text', text: { content: '' } }];
}
function mdToBlocks(md) {
  const lines = md.split(/\r?\n/); const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]; if (!l.trim()) continue;
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; } i--;
      const parse = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const data = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(parse);
      if (data.length) { const w = Math.max(...data.map((r) => r.length));
        blocks.push({ type: 'table', table: { table_width: w, has_column_header: true, has_row_header: false, children: data.map((cells) => ({ type: 'table_row', table_row: { cells: Array.from({ length: w }, (_, k) => rich(cells[k] ?? '')) } })) } }); }
      continue;
    }
    let mm;
    if ((mm = l.match(/^#\s+(.*)/))) blocks.push({ type: 'heading_1', heading_1: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^##\s+(.*)/))) blocks.push({ type: 'heading_2', heading_2: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^###\s+(.*)/))) blocks.push({ type: 'heading_3', heading_3: { rich_text: rich(mm[1]) } });
    else if (/^---\s*$/.test(l)) blocks.push({ type: 'divider', divider: {} });
    else if ((mm = l.match(/^>\s?(.*)/))) blocks.push({ type: 'quote', quote: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^[-*]\s+\[([ xX])\]\s+(.*)/))) blocks.push({ type: 'to_do', to_do: { checked: mm[1].toLowerCase() === 'x', rich_text: rich(mm[2]) } });
    else if ((mm = l.match(/^[-*]\s+(.*)/))) blocks.push({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(mm[1]) } });
    else blocks.push({ type: 'paragraph', paragraph: { rich_text: rich(l) } });
  }
  return blocks;
}

const TASKS = [
  ['SRT 자동 생성 + 브라우저 편집기', '완료', '높음', ['기능']],
  ['번인 자막 스튜디오 (프리셋·카라오케)', '완료', '높음', ['기능']],
  ['화자 분리 (speaker diarization)', '완료', '중간', ['기능']],
  ['다국어 번역 (DeepL · 영·일·중)', '완료', '높음', ['기능']],
  ['자막 스타일 어시 Tier1 (영상분석→추천)', '완료', '중간', ['기능']],
  ['흑백 미니멀 재디자인 + 모바일 에디터', '완료', '중간', ['UI']],
  ['prod 배포 (밀린 커밋 vercel --prod)', '진행 중', '높음', ['운영']],
  ['클라우드 워커(RunPod) 24/7 전환', '시작 전', '높음', ['인프라']],
  ['수익화 방향 확정', '시작 전', '높음', ['사업']],
  ['per-IP 레이트리밋 (어뷰징 방어)', '시작 전', '중간', ['운영']],
  ['first-party 분석 (Supabase)', '시작 전', '중간', ['기능']],
];

(async () => {
  // 0) 잘못된 위치의 단독 페이지 보관
  const arch = await api(`pages/${OLD_PAGE}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
  console.log('이전 단독 페이지 보관:', arch.ok ? '✅' : `(${arch.status})`);

  // 1) 프로젝트 find-or-create
  const found = await api(`databases/${DB_PROJECT}/query`, { method: 'POST', body: JSON.stringify({ filter: { property: '프로젝트 이름', title: { contains: 'make_cc' } }, page_size: 1 }) });
  let projectId = found.json.results?.[0]?.id;
  const docBlocks = mdToBlocks(fs.readFileSync('docs/notion-project-page.md', 'utf8')).filter((b) => b.type !== 'heading_1');
  if (projectId) {
    console.log('기존 make_cc 프로젝트 발견 → 재사용', projectId);
  } else {
    const create = await api('pages', { method: 'POST', body: JSON.stringify({
      parent: { database_id: DB_PROJECT },
      properties: {
        '프로젝트 이름': { title: rich('make_cc — 한국어 자막 자동생성') },
        '상태': { status: { name: '진행 중' } },
        '우선순위': { select: { name: '높음' } },
        '날짜': { date: { start: '2026-06-13' } },
        '요약': { rich_text: rich('한국어 영상 → 자동 자막·편집·번인·다국어 번역 풀스택 웹 서비스 (makecc.vercel.app)') },
      },
      children: docBlocks.slice(0, 90),
    }) });
    if (!create.ok) { console.error('프로젝트 생성 실패', create.status, JSON.stringify(create.json).slice(0, 300)); process.exit(1); }
    projectId = create.json.id;
    console.log('프로젝트 "make_cc" 생성 ✅', create.json.url);
    for (let k = 90; k < docBlocks.length; k += 90) await api(`blocks/${projectId}/children`, { method: 'PATCH', body: JSON.stringify({ children: docBlocks.slice(k, k + 90) }) });
  }

  // 2) 작업 생성 (제목 중복 체크)
  let created = 0, skipped = 0;
  for (const [name, status, prio, tags] of TASKS) {
    const ex = await api(`databases/${DB_TASK}/query`, { method: 'POST', body: JSON.stringify({ filter: { property: '작업 이름', title: { equals: name } }, page_size: 1 }) });
    if (ex.json.results?.length) { skipped++; continue; }
    const r = await api('pages', { method: 'POST', body: JSON.stringify({
      parent: { database_id: DB_TASK },
      properties: {
        '작업 이름': { title: rich(name) },
        '상태': { status: { name: status } },
        '우선순위': { select: { name: prio } },
        '태그': { multi_select: tags.map((t) => ({ name: t })) },
        '프로젝트': { relation: [{ id: projectId }] },
      },
    }) });
    r.ok ? created++ : console.error('작업 실패:', name, r.status, JSON.stringify(r.json).slice(0, 150));
  }
  console.log(`작업: 생성 ${created} · 건너뜀(이미 있음) ${skipped} / 총 ${TASKS.length}`);
  console.log('\n완료. 노션 "프로젝트" DB에서 make_cc 확인하세요.');
})();
