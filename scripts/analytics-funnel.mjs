import { createClient } from '@supabase/supabase-js';

// first-party 퍼널 리포트 — prod analytics_events를 service_role로 집계.
// 사용: npm run funnel [일수]   (기본 30일)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('env 없음 (.env)'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const days = Number(process.argv[2] ?? 30);
const sinceIso = new Date(Date.now() - days * 864e5).toISOString();

const FUNNEL = [
  ['page_view', '방문(page_view)'],
  ['upload_started', '업로드 시작'],
  ['upload_completed', '업로드 완료(잡 생성)'],
  ['job_finished', '자막 완성'],
  ['editor_opened', '편집기 진입'],
  ['srt_downloaded', 'SRT 다운로드'],
];

async function fetchAll() {
  const page = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await sb
      .from('analytics_events')
      .select('event, session_id, anon_id, path, referrer, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) { console.error('analytics_events 조회 실패:', error.message); process.exit(1); }
    out.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

const rows = await fetchAll();

const sessionsByEvent = new Map(FUNNEL.map(([ev]) => [ev, new Set()]));
for (const r of rows) {
  const set = sessionsByEvent.get(r.event);
  if (set) set.add(r.session_id ?? r.anon_id ?? '?');
}

console.log(`\n================ make_cc 퍼널 (최근 ${days}일) ================\n`);
console.log(`총 이벤트 ${rows.length}건 · 고유 방문 세션 ${sessionsByEvent.get('page_view').size}\n`);

const base = sessionsByEvent.get('page_view').size || 1;
let prev = null;
for (const [ev, label] of FUNNEL) {
  const n = sessionsByEvent.get(ev).size;
  const pctBase = ((n / base) * 100).toFixed(1);
  const stepConv = prev && prev.n ? `  (직전 대비 ${((n / prev.n) * 100).toFixed(1)}%)` : '';
  const bar = '█'.repeat(Math.round((n / base) * 24)).padEnd(24, '░');
  console.log(`${label.padEnd(22)} ${String(n).padStart(6)}  ${bar} ${pctBase}%${stepConv}`);
  prev = { n };
}

// 유입 경로 (page_view referrer)
const refCount = {};
for (const r of rows) {
  if (r.event !== 'page_view') continue;
  let ref = r.referrer || '(direct)';
  try { if (ref !== '(direct)') ref = new URL(ref).hostname; } catch { /* keep raw */ }
  refCount[ref] = (refCount[ref] || 0) + 1;
}
console.log('\n■ 유입 경로 (page_view)');
for (const [ref, c] of Object.entries(refCount).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${String(c).padStart(5)}  ${ref}`);
}

// 인기 페이지
const pathCount = {};
for (const r of rows) {
  if (r.event === 'page_view' && r.path) pathCount[r.path] = (pathCount[r.path] || 0) + 1;
}
console.log('\n■ 인기 페이지');
for (const [p, c] of Object.entries(pathCount).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${String(c).padStart(5)}  ${p}`);
}

console.log('\n(소스: prod Supabase analytics_events, service_role 집계)');
