// 노션 동기화 — docs/notion-project-page.md 를 노션 페이지로 생성/갱신.
// 의존성 없음(raw fetch). 토큰은 .env에서 직접 파싱.
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const pick = (k) => (env.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)$`, 'm')) || [])[1]?.trim();
const TOKEN = pick('NOTION_TOKEN');
let PARENT = pick('NOTION_PARENT_PAGE_ID'); // 없으면 검색으로 첫 접근가능 페이지 사용
const DOC = 'docs/notion-project-page.md';
if (!TOKEN) { console.error('NOTION_TOKEN 없음'); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const api = (path, opt = {}) => fetch(`https://api.notion.com/v1/${path}`, { headers: H, ...opt }).then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json() }));

// ---- 인라인 마크다운 → rich_text ----
function rich(text) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m;
  const push = (content, ann = {}, link = null) => { if (content) out.push({ type: 'text', text: { content, link: link ? { url: link } : null }, annotations: ann }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[2]) push(m[2], { bold: true });
    else if (m[3]) push(m[3], { code: true });
    else if (m[4]) push(m[4], {}, m[5]);
    last = re.lastIndex;
  }
  push(text.slice(last));
  return out.length ? out : [{ type: 'text', text: { content: '' } }];
}

// ---- 마크다운 → 블록 ----
function mdToBlocks(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let title = 'make_cc';
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (!l.trim()) continue;
    // 테이블
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      i--;
      const parse = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const dataRows = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(parse);
      if (dataRows.length) {
        const width = Math.max(...dataRows.map((r) => r.length));
        blocks.push({ type: 'table', table: { table_width: width, has_column_header: true, has_row_header: false,
          children: dataRows.map((cells) => ({ type: 'table_row', table_row: { cells: Array.from({ length: width }, (_, k) => rich(cells[k] ?? '')) } })) } });
      }
      continue;
    }
    let mm;
    if ((mm = l.match(/^#\s+(.*)/))) { title = mm[1].trim(); blocks.push({ type: 'heading_1', heading_1: { rich_text: rich(mm[1]) } }); }
    else if ((mm = l.match(/^##\s+(.*)/))) blocks.push({ type: 'heading_2', heading_2: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^###\s+(.*)/))) blocks.push({ type: 'heading_3', heading_3: { rich_text: rich(mm[1]) } });
    else if (/^---\s*$/.test(l)) blocks.push({ type: 'divider', divider: {} });
    else if ((mm = l.match(/^>\s?(.*)/))) blocks.push({ type: 'quote', quote: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^[-*]\s+\[([ xX])\]\s+(.*)/))) blocks.push({ type: 'to_do', to_do: { checked: mm[1].toLowerCase() === 'x', rich_text: rich(mm[2]) } });
    else if ((mm = l.match(/^[-*]\s+(.*)/))) blocks.push({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(mm[1]) } });
    else if ((mm = l.match(/^\d+\.\s+(.*)/))) blocks.push({ type: 'numbered_list_item', numbered_list_item: { rich_text: rich(mm[1]) } });
    else blocks.push({ type: 'paragraph', paragraph: { rich_text: rich(l) } });
  }
  return { title, blocks };
}

(async () => {
  // 부모 페이지 결정
  if (!PARENT) {
    const s = await api('search', { method: 'POST', body: JSON.stringify({ filter: { property: 'object', value: 'page' }, page_size: 5 }) });
    const pg = (s.json.results || []).find((r) => r.object === 'page');
    if (!pg) { console.error('접근 가능한 부모 페이지가 없습니다. 노션에서 페이지를 통합과 연결하세요.'); process.exit(1); }
    PARENT = pg.id;
    console.log('부모 페이지(자동 선택):', PARENT);
  }
  const { title, blocks } = mdToBlocks(fs.readFileSync(DOC, 'utf8'));
  const body = blocks.filter((b) => b.type !== 'heading_1' || blocks.indexOf(b) !== blocks.findIndex((x) => x.type === 'heading_1')); // 첫 H1은 제목으로
  console.log(`블록 ${body.length}개, 제목 "${title}"`);

  // 페이지 생성 (children 최대 100)
  const first = body.slice(0, 90);
  const create = await api('pages', { method: 'POST', body: JSON.stringify({
    parent: { page_id: PARENT },
    properties: { title: { title: rich(title) } },
    children: first,
  }) });
  if (!create.ok) { console.error('페이지 생성 실패', create.status, JSON.stringify(create.json).slice(0, 300)); process.exit(1); }
  const pageId = create.json.id;
  console.log('페이지 생성 ✅', pageId);

  // 나머지 블록 append (90개씩)
  for (let k = 90; k < body.length; k += 90) {
    const chunk = body.slice(k, k + 90);
    const ap = await api(`blocks/${pageId}/children`, { method: 'PATCH', body: JSON.stringify({ children: chunk }) });
    if (!ap.ok) { console.error('append 실패', ap.status, JSON.stringify(ap.json).slice(0, 200)); break; }
    console.log(`  +${chunk.length} 블록 추가`);
  }
  console.log('\n완료 → ' + (create.json.url || `https://notion.so/${pageId.replace(/-/g, '')}`));
})();
