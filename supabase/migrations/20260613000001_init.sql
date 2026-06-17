-- =========================================================
-- make_cc 초기 스키마
-- Supabase Postgres (auth.users 활용)
-- 참조: docs/02-design/features/video-auto-caption.design.md §3
-- =========================================================

-- 1. 도메인 enum
create type owner_type as enum ('user', 'guest');

create type job_status as enum (
  'pending',
  'uploading',
  'queued',
  'transcribing',
  'finished',
  'failed',
  'cancelled'
);

-- =========================================================
-- 2. jobs — 잡 상태 머신 (Design §3.1)
-- =========================================================
create table public.jobs (
  id text primary key default gen_random_uuid()::text,

  -- 소유자
  owner_type owner_type not null,
  owner_id   text       not null,                   -- auth.users.id 또는 anonymousId 쿠키값
  user_id    uuid       references auth.users(id) on delete set null,

  -- 상태
  status job_status not null default 'pending',
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  queue_position int,

  -- 영상 메타
  video_original_name text not null,
  video_size_bytes    bigint not null check (video_size_bytes > 0),
  video_duration_sec  int not null check (video_duration_sec > 0),
  video_storage_key   text not null,

  -- 자막 결과
  subtitle_storage_key text,

  -- 메타
  language      text not null default 'ko',
  error_code    text,
  error_message text,

  -- 타임스탬프
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  video_delete_at timestamptz   -- 자동 삭제 예정 시각
);

create index jobs_owner_idx     on public.jobs (owner_type, owner_id, created_at desc);
create index jobs_status_idx    on public.jobs (status, created_at);
create index jobs_delete_at_idx on public.jobs (video_delete_at) where video_delete_at is not null;

-- owner_type='user'일 때 user_id 일치 보장 (앱 레이어 + 트리거 이중 방어)
create or replace function public.jobs_owner_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.owner_type = 'user' then
    if new.user_id is null or new.user_id::text <> new.owner_id then
      raise exception 'owner_type=user일 때 user_id와 owner_id가 일치해야 합니다';
    end if;
  else
    -- guest
    if new.user_id is not null then
      raise exception 'owner_type=guest일 때 user_id는 null이어야 합니다';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_owner_consistency_trg
before insert or update on public.jobs
for each row execute function public.jobs_owner_consistency();

-- =========================================================
-- 3. job_events — append-only 감사 로그
-- =========================================================
create table public.job_events (
  id         text primary key default gen_random_uuid()::text,
  job_id     text not null references public.jobs(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index job_events_job_idx on public.job_events (job_id, created_at);

-- =========================================================
-- 4. share_links — 회원이 생성하는 공유 토큰
-- =========================================================
create table public.share_links (
  id         text primary key default gen_random_uuid()::text,
  job_id     text not null unique references public.jobs(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  hits       int not null default 0
);

create index share_links_token_idx on public.share_links (token);

-- =========================================================
-- 5. daily_guest_usage — 게스트 글로벌 일일 캡
-- =========================================================
create table public.daily_guest_usage (
  date               text primary key,                -- YYYY-MM-DD (UTC)
  total_jobs         int not null default 0,
  total_duration_sec int not null default 0
);

-- =========================================================
-- 6. RLS (Row Level Security)
-- =========================================================
alter table public.jobs              enable row level security;
alter table public.job_events        enable row level security;
alter table public.share_links       enable row level security;
alter table public.daily_guest_usage enable row level security;

-- 6.1 회원: 자기 잡만 read/update/cancel
create policy "jobs_owner_select"
  on public.jobs for select
  using (owner_type = 'user' and user_id = auth.uid());

create policy "jobs_owner_update"
  on public.jobs for update
  using (owner_type = 'user' and user_id = auth.uid())
  with check (owner_type = 'user' and user_id = auth.uid());

-- 6.2 회원 자신의 잡 이벤트 조회
create policy "job_events_owner_select"
  on public.job_events for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_events.job_id
        and j.owner_type = 'user'
        and j.user_id = auth.uid()
    )
  );

-- 6.3 공유 링크: 회원이 자기 잡에 대해 생성·조회·폐기
create policy "share_links_owner_all"
  on public.share_links for all
  using (
    exists (
      select 1 from public.jobs j
      where j.id = share_links.job_id
        and j.owner_type = 'user'
        and j.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = share_links.job_id
        and j.owner_type = 'user'
        and j.user_id = auth.uid()
    )
  );

-- 6.4 daily_guest_usage: 서비스 외 접근 차단 (admin/service_role만)
-- (정책 미정의 → 일반 사용자는 접근 불가, service_role은 RLS 우회)

-- 게스트 잡 + 잡 생성(insert) + 워커 작업은 service_role이 우회하여 처리
-- (서버 코드에서 createAdminClient() 사용)

-- =========================================================
-- 7. Storage 버킷 + 정책
-- (Supabase Storage는 마이그레이션 외 별도 SQL/Console로도 가능)
-- =========================================================
insert into storage.buckets (id, name, public)
values
  ('videos',    'videos',    false),
  ('subtitles', 'subtitles', false)
on conflict (id) do nothing;

-- 영상·자막은 service_role을 통해서만 업로드/다운로드 (서버 프록시 or signed URL)
-- 일반 사용자가 직접 접근 못 함 (RLS by default → policy 없음)
