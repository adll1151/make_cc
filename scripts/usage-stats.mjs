import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('env 없음'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const now = Date.now();
const since = (days) => new Date(now - days * 864e5).toISOString();

async function countWhere(table, build) {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) return `ERR(${error.message})`;
  return count ?? 0;
}

console.log('================ make_cc 사용량 ================\n');

// JOBS
const { data: jobs, error: je } = await sb
  .from('jobs')
  .select('status, owner_type, owner_id, user_id, created_at, video_duration_sec, finished_at');
if (je) { console.error('jobs 조회 실패:', je.message); process.exit(1); }

const total = jobs.length;
const by = (k) => jobs.reduce((m, j) => ((m[j[k]] = (m[j[k]] || 0) + 1), m), {});
const inLast = (days) => jobs.filter((j) => j.created_at >= since(days)).length;
const finished = jobs.filter((j) => j.status === 'finished');
const totalDur = jobs.reduce((s, j) => s + (j.video_duration_sec || 0), 0);
const finDur = finished.reduce((s, j) => s + (j.video_duration_sec || 0), 0);
const uniqOwners = new Set(jobs.map((j) => j.owner_id)).size;
const uniqUsers = new Set(jobs.filter((j) => j.user_id).map((j) => j.user_id)).size;

console.log(`■ 잡(영상 처리) 총 ${total}건`);
console.log('  상태별:', JSON.stringify(by('status')));
console.log('  주체별:', JSON.stringify(by('owner_type')), `(고유 owner ${uniqOwners} · 회원 ${uniqUsers}명)`);
console.log(`  기간: 오늘 ${inLast(1)} · 7일 ${inLast(7)} · 30일 ${inLast(30)}`);
console.log(`  성공(finished) ${finished.length}건 / 처리영상 합계 ${(finDur/60).toFixed(1)}분 (전체 업로드 ${(totalDur/60).toFixed(1)}분)`);
const fr = total ? ((finished.length / total) * 100).toFixed(0) : 0;
console.log(`  성공률 ${fr}%`);

// RENDERS / TRANSLATIONS
const renders = await countWhere('renders');
const rendersDone = await countWhere('renders', (q) => q.eq('status', 'done'));
const translations = await countWhere('translations');
const translationsDone = await countWhere('translations', (q) => q.eq('status', 'done'));
console.log(`\n■ 번인 렌더: ${renders}건 (완료 ${rendersDone})`);
console.log(`■ 번역: ${translations}건 (완료 ${translationsDone})`);

// USER PROFILES (회원 수)
const profiles = await countWhere('user_profiles');
const pros = await countWhere('user_profiles', (q) => q.eq('is_pro', true));
console.log(`\n■ 회원: ${profiles}명 (Pro ${pros})`);

console.log('\n(소스: prod Supabase, service_role 집계)');
