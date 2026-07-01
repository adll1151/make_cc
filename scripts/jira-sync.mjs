// Jira 로드맵 동기화 — scripts/jira-roadmap.json 의 Epic/Story를 Jira에 반영(멱등, 수렴형).
//
// 사용:   npm run jira:sync
// 필요 env (.env):
//   JIRA_BASE_URL     https://your-site.atlassian.net   (사이트 루트만! 보드 URL 아님)
//   JIRA_EMAIL        Atlassian 로그인 이메일
//   JIRA_API_TOKEN    https://id.atlassian.com/manage-profile/security/api-tokens
//   JIRA_PROJECT_KEY  프로젝트 키 (예: KAN)
//
// 동작(재실행 안전):
//   1) 이슈 생성 (기존 summary는 건너뜀 — 프로젝트 이슈를 한 번 조회해 summary→key 맵)
//   2) 우선순위 설정 (roadmap.priority, Story는 Epic 상속)
//   3) 상태 전환 (status: done→완료 / in-progress→진행 중; 상태 카테고리 기준=언어 독립)
// 검색은 신 엔드포인트 POST /rest/api/3/search/jql 사용(구 /search는 410 삭제됨).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.JIRA_BASE_URL?.replace(/\/+$/, '');
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT = process.env.JIRA_PROJECT_KEY;

if (!BASE || !EMAIL || !TOKEN || !PROJECT) {
  console.error('env 누락 — .env 에 JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN / JIRA_PROJECT_KEY 필요');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const HEADERS = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' };

const __dir = dirname(fileURLToPath(import.meta.url));
const roadmap = JSON.parse(readFileSync(join(__dir, 'jira-roadmap.json'), 'utf8'));

async function call(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof json === 'string' ? json.slice(0, 200) : JSON.stringify(json)}`);
  }
  return json;
}

// 프로젝트 기존 이슈를 summary→key 맵으로 (신 검색 API, 토큰 페이지네이션)
async function loadExisting() {
  const map = new Map();
  let nextPageToken;
  for (;;) {
    const body = { jql: `project = "${PROJECT}"`, maxResults: 100, fields: ['summary'] };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const r = await call('/rest/api/3/search/jql', 'POST', body);
    for (const i of r.issues || []) map.set(i.fields.summary, i.key);
    if (r.isLast || !r.nextPageToken) break;
    nextPageToken = r.nextPageToken;
  }
  return map;
}

async function ensureIssue(existing, { summary, issuetype, parentKey, labels, priority }) {
  if (existing.has(summary)) {
    const key = existing.get(summary);
    console.log(`  = ${issuetype.padEnd(5)} 존재  ${key}  ${summary}`);
    return key;
  }
  const fields = { project: { key: PROJECT }, summary, issuetype: { name: issuetype }, labels: labels || [] };
  if (parentKey) fields.parent = { key: parentKey };
  if (priority) fields.priority = { name: priority };
  const created = await call('/rest/api/2/issue', 'POST', { fields });
  existing.set(summary, created.key);
  console.log(`  + ${issuetype.padEnd(5)} 생성  ${created.key}  ${summary}`);
  return created.key;
}

// 상태 카테고리로 전환(언어 독립): new / indeterminate / done
async function transitionTo(key, categoryKey) {
  const cur = await call(`/rest/api/2/issue/${key}?fields=status`);
  if (cur.fields.status?.statusCategory?.key === categoryKey) return false;
  const tr = await call(`/rest/api/2/issue/${key}/transitions`);
  const t = (tr.transitions || []).find((x) => x.to?.statusCategory?.key === categoryKey);
  if (!t) return false;
  await call(`/rest/api/2/issue/${key}/transitions`, 'POST', { transition: { id: t.id } });
  return true;
}

// 우선순위 + 상태를 로드맵대로 수렴
async function applyState(key, priority, status) {
  if (priority) {
    try { await call(`/rest/api/2/issue/${key}`, 'PUT', { fields: { priority: { name: priority } } }); }
    catch (e) { console.error(`    ! priority 실패 ${key}: ${e.message}`); }
  }
  const cat = status === 'done' ? 'done' : status === 'in-progress' ? 'indeterminate' : null;
  if (cat) {
    try {
      if (await transitionTo(key, cat)) console.log(`    → ${key} 상태전환 → ${status}`);
    } catch (e) { console.error(`    ! 전환 실패 ${key}: ${e.message}`); }
  }
}

// 시작일 필드 ID 자동 탐색(사이트마다 customfield 번호가 다름). 마감일은 표준 duedate.
async function findStartDateField() {
  try {
    const fields = await call('/rest/api/2/field');
    const f = fields.find((x) => x.schema?.type === 'date' && /start date|시작/i.test(x.name));
    return f?.id || null;
  } catch { return null; }
}

// Epic 타임라인 기간(실제 개발 기간) 설정
async function applyEpicDates(key, start, due, startField) {
  const fields = {};
  if (start && startField) fields[startField] = start;
  if (due) fields.duedate = due;
  if (Object.keys(fields).length === 0) return;
  try {
    await call(`/rest/api/2/issue/${key}`, 'PUT', { fields });
    console.log(`    · ${key} 기간 ${start || '?'} ~ ${due || '?'}`);
  } catch (e) {
    console.error(`    ! 날짜 실패 ${key}: ${e.message}`);
  }
}

console.log(`Jira 동기화 → ${BASE}  (project ${PROJECT})\n`);

const existing = await loadExisting();
const startField = await findStartDateField();
console.log(`기존 이슈 ${existing.size}건 로드 · 시작일 필드 ${startField || '(미탐지)'}\n`);

let epicN = 0, storyN = 0, failN = 0;
for (const epic of roadmap) {
  const labels = ['roadmap', ...(epic.status ? [`status-${epic.status}`] : [])];
  let epicKey;
  try {
    epicKey = await ensureIssue(existing, { summary: epic.epic, issuetype: 'Epic', labels, priority: epic.priority });
    await applyState(epicKey, epic.priority, epic.status);
    await applyEpicDates(epicKey, epic.start, epic.due, startField);
    epicN++;
  } catch (e) {
    console.error(`  ! Epic 실패: ${epic.epic} — ${e.message}`);
    failN++;
    continue;
  }
  for (const story of epic.stories || []) {
    const sLabels = ['roadmap', ...(story.status ? [`status-${story.status}`] : [])];
    const sp = story.priority ?? epic.priority;
    try {
      const skey = await ensureIssue(existing, { summary: story.summary, issuetype: 'Story', parentKey: epicKey, labels: sLabels, priority: sp });
      await applyState(skey, sp, story.status);
      storyN++;
    } catch (e) {
      console.error(`    ! Story 실패: ${story.summary} — ${e.message}`);
      failN++;
    }
  }
}

console.log(`\n완료 — Epic ${epicN} · Story ${storyN}${failN ? ` · 실패 ${failN}` : ''}`);
console.log('보드에서 확인하세요 — 완료=완료 컬럼, 진행중=진행 중, 우선순위 반영됨.');
