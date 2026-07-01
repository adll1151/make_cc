import { z } from 'zod';

/**
 * first-party 분석 — 퍼널 이벤트만 한정 수집 (외부 SaaS 없이 Supabase 직접 적재).
 * 새 퍼널 단계 추가 = 여기 이벤트명 1개 + 클라이언트 track() 호출 1줄.
 */
export const ANALYTICS_EVENTS = [
  'page_view',
  'upload_started',
  'upload_completed',
  'job_finished',
  'editor_opened',
  'srt_downloaded',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const propertyValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const analyticsEventInputSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  path: z.string().max(512).optional(),
  jobId: z.string().max(64).optional(),
  properties: z.record(propertyValue).optional(),
  ts: z.number().int().nonnegative().optional(),
});

export const analyticsBatchSchema = z.object({
  sessionId: z.string().min(8).max(64),
  referrer: z.string().max(1024).optional(),
  events: z.array(analyticsEventInputSchema).min(1).max(20),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventInputSchema>;
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

// ── 운영자 대시보드 퍼널 집계 타입 (client-safe) ──────────

export interface FunnelStep {
  event: AnalyticsEventName;
  label: string;
  sessions: number;
  pctOfTop: number; // 방문(최상단) 대비 %
  stepConv: number | null; // 직전 단계 대비 %
}

export interface FunnelKpi {
  key: string;
  label: string;
  value: number;
  suffix?: string;
  delta: number | null; // 이전 동일 기간 대비 (null=비교 불가)
  deltaSuffix: '%' | 'pp';
}

export interface FunnelSummary {
  sinceDays: number;
  totalEvents: number;
  topSessions: number;
  kpis: FunnelKpi[];
  steps: FunnelStep[];
  referrers: { name: string; count: number }[];
  paths: { path: string; count: number }[];
  generatedAt: string;
}
