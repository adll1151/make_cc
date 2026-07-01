-- =========================================================
-- analytics: analytics_events (first-party 퍼널 이벤트)
-- 참조: docs/01-plan/features/analytics.plan.md
-- 외부 SaaS 없이 Supabase에 직접 적재. 조회는 운영자(service_role) 전용.
-- =========================================================

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,                     -- page_view / upload_started / ... (앱 allowlist로 강제)
  path text,
  job_id text,                             -- 잡 연관 이벤트 (FK 아님: 게스트/삭제 잡도 허용)
  session_id text,                         -- 브라우저 세션 (mcc_sid)
  anon_id text,                            -- 게스트 식별 (mcc_anon 쿠키)
  user_id uuid references auth.users(id) on delete set null,
  properties jsonb not null default '{}',
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index analytics_events_event_time_idx on public.analytics_events (event, created_at desc);
create index analytics_events_time_idx on public.analytics_events (created_at desc);
create index analytics_events_session_idx on public.analytics_events (session_id);

-- RLS: 조회 정책 없음 = 일반/게스트는 아무것도 못 읽는다. 쓰기·읽기 모두 service_role만.
alter table public.analytics_events enable row level security;

comment on table public.analytics_events is 'first-party 퍼널 이벤트. 운영자(service_role) 전용 — 클라 조회 차단';
comment on column public.analytics_events.event is 'services/types/analytics.ts ANALYTICS_EVENTS allowlist로 검증됨';
