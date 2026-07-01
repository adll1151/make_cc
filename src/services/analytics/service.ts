import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import type { Json } from '@/lib/supabase/database.types';
import type { OwnerContext } from '@/types/session';
import type {
  AnalyticsBatch,
  AnalyticsEventName,
  FunnelStep,
  FunnelSummary,
  FunnelKpi,
} from '@/types/analytics';

/**
 * 퍼널 이벤트 적재 (append-only).
 *
 * - 신원: 회원=user_id, 게스트=anon_id(mcc_anon 쿠키). 둘 다 서버에서 결정(클라 위조 방지).
 * - 분석은 부가 기능 → insert 실패해도 throw하지 않고 로그만 남긴다(사용자 흐름 보호).
 * - service_role(admin)로 insert. RLS는 조회를 완전 차단(운영자 전용).
 */
export async function recordAnalyticsEvents(params: {
  batch: AnalyticsBatch;
  owner: OwnerContext | null;
  userAgent?: string | null;
}): Promise<void> {
  const { batch, owner, userAgent } = params;
  const anonId = owner?.kind === 'guest' ? owner.anonymousId : null;
  const userId = owner?.kind === 'user' ? owner.userId : null;

  const rows = batch.events.map((e) => ({
    event: e.event,
    path: e.path ?? null,
    job_id: e.jobId ?? null,
    properties: (e.properties ?? {}) as Json,
    session_id: batch.sessionId,
    anon_id: anonId,
    user_id: userId,
    referrer: batch.referrer ?? null,
    user_agent: userAgent ?? null,
  }));

  const admin = createAdminClient();
  const { error } = await admin.from('analytics_events').insert(rows);
  if (error) {
    logger.warn({ err: error, count: rows.length }, 'analytics insert 실패');
  }
}

// ── 운영자 대시보드용 퍼널 집계 (타입은 @/types/analytics) ──

const FUNNEL: { event: AnalyticsEventName; label: string }[] = [
  { event: 'page_view', label: '방문' },
  { event: 'upload_started', label: '업로드 시작' },
  { event: 'upload_completed', label: '업로드 완료' },
  { event: 'job_finished', label: '자막 완성' },
  { event: 'editor_opened', label: '편집기 진입' },
  { event: 'srt_downloaded', label: 'SRT 다운로드' },
];

interface EventRow {
  event: string;
  session_id: string | null;
  anon_id: string | null;
  path: string | null;
  referrer: string | null;
  created_at: string;
}

const sessKey = (r: EventRow) => r.session_id ?? r.anon_id ?? '?';

function sessionsPerEvent(rows: EventRow[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const { event } of FUNNEL) m.set(event, new Set());
  for (const r of rows) m.get(r.event)?.add(sessKey(r));
  return m;
}
const evCount = (m: Map<string, Set<string>>, ev: string) => m.get(ev)?.size ?? 0;
const pctDelta = (cur: number, prev: number): number | null =>
  prev <= 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10;

/**
 * analytics_events(운영자 전용, service_role)를 현재/이전 두 창으로 집계.
 * KPI는 이전 동일 기간 대비 증감(Δ)까지 계산.
 */
export async function getFunnelSummary(opts?: { sinceDays?: number }): Promise<FunnelSummary> {
  const sinceDays = opts?.sinceDays ?? 30;
  const admin = createAdminClient();
  const now = Date.now();
  const sinceIso = new Date(now - sinceDays * 86_400_000).toISOString();
  const prevIso = new Date(now - 2 * sinceDays * 86_400_000).toISOString();

  const all: EventRow[] = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    const { data, error } = await admin
      .from('analytics_events')
      .select('event, session_id, anon_id, path, referrer, created_at')
      .gte('created_at', prevIso)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      logger.warn({ err: error }, 'funnel 조회 실패');
      break;
    }
    all.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < page) break;
  }

  const cur = all.filter((r) => r.created_at >= sinceIso);
  const prev = all.filter((r) => r.created_at < sinceIso);
  const curS = sessionsPerEvent(cur);
  const prevS = sessionsPerEvent(prev);

  const top = evCount(curS, 'page_view');
  const prevTop = evCount(prevS, 'page_view');

  let prevStep: number | null = null;
  const steps: FunnelStep[] = FUNNEL.map(({ event, label }) => {
    const sessions = evCount(curS, event);
    const stepConv = prevStep != null && prevStep > 0 ? Math.round((sessions / prevStep) * 1000) / 10 : null;
    prevStep = sessions;
    return {
      event,
      label,
      sessions,
      pctOfTop: top > 0 ? Math.round((sessions / top) * 1000) / 10 : 0,
      stepConv,
    };
  });

  const finished = evCount(curS, 'job_finished');
  const downloaded = evCount(curS, 'srt_downloaded');
  const convNow = top > 0 ? Math.round((downloaded / top) * 1000) / 10 : 0;
  const convPrev = prevTop > 0 ? Math.round((evCount(prevS, 'srt_downloaded') / prevTop) * 1000) / 10 : 0;

  const kpis: FunnelKpi[] = [
    { key: 'visits', label: '방문 세션', value: top, delta: pctDelta(top, prevTop), deltaSuffix: '%' },
    { key: 'finished', label: '자막 완성', value: finished, delta: pctDelta(finished, evCount(prevS, 'job_finished')), deltaSuffix: '%' },
    { key: 'downloads', label: 'SRT 다운로드', value: downloaded, delta: pctDelta(downloaded, evCount(prevS, 'srt_downloaded')), deltaSuffix: '%' },
    { key: 'conv', label: '전환율', value: convNow, suffix: '%', delta: prevTop > 0 ? Math.round((convNow - convPrev) * 10) / 10 : null, deltaSuffix: 'pp' },
  ];

  const refCount = new Map<string, number>();
  const pathCount = new Map<string, number>();
  for (const r of cur) {
    if (r.event !== 'page_view') continue;
    let ref = r.referrer || '(direct)';
    if (ref !== '(direct)') {
      try { ref = new URL(ref).hostname; } catch { /* keep raw */ }
    }
    refCount.set(ref, (refCount.get(ref) ?? 0) + 1);
    if (r.path) pathCount.set(r.path, (pathCount.get(r.path) ?? 0) + 1);
  }
  const topN = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  return {
    sinceDays,
    totalEvents: cur.length,
    topSessions: top,
    kpis,
    steps,
    referrers: topN(refCount, 6).map(([name, count]) => ({ name, count })),
    paths: topN(pathCount, 6).map(([path, count]) => ({ path, count })),
    generatedAt: new Date().toISOString(),
  };
}
