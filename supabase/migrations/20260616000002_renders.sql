-- =========================================================
-- burnin-captions: renders (번인 자막 영상 출력) + is_pro 게이팅
-- 참조: docs/02-design/features/burnin-captions.design.md §3
-- =========================================================

create table public.renders (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'rendering', 'done', 'failed')),

  aspect text not null default 'original'
    check (aspect in ('original', '9:16', '1:1')),
  resolution int not null default 720,
  watermark boolean not null default true,
  style jsonb not null,

  output_storage_key text,
  error_message text,

  created_at timestamptz not null default now(),
  finished_at timestamptz,
  output_delete_at timestamptz
);

create index renders_job_idx on public.renders (job_id, created_at desc);
create index renders_delete_at_idx on public.renders (output_delete_at)
  where output_delete_at is not null;

-- RLS: 본인(회원) 잡의 렌더만 조회. 워커/시스템 쓰기는 admin(service_role) 우회
alter table public.renders enable row level security;

create policy "renders_owner_select"
  on public.renders for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = renders.job_id
        and j.owner_type = 'user'
        and j.user_id = auth.uid()
    )
  );

comment on table public.renders is '번인 자막 영상 출력 잡. STT(jobs)와 별개 생명주기';
comment on column public.renders.watermark is '무료 티어 워터마크 여부 (서버·워커 강제)';

-- =========================================================
-- 게이팅: user_profiles.is_pro (결제 연동 전 수동/관리자 토글)
-- =========================================================
alter table public.user_profiles
  add column if not exists is_pro boolean not null default false;

comment on column public.user_profiles.is_pro is
  'Pro 구독 여부. 번인 워터마크 제거·1080p·전체 템플릿 게이팅. 추후 subscriptions 테이블로 이관 가능';

-- =========================================================
-- renders 스토리지 버킷 (private)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;
