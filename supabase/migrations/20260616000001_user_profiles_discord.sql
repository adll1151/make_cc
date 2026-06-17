-- =========================================================
-- discord-integration: user_profiles
-- Discord Account Linking + 알림 경로(notify_channel)
-- 참조: docs/02-design/features/discord-integration.design.md §3
-- =========================================================

create table public.user_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,

  -- Discord Account Linking (null = 미연결)
  discord_user_id    text,
  discord_username   text,

  -- 알림 경로: email | discord | both. 미연결 사용자는 email 고정
  notify_channel     text not null default 'email'
    check (notify_channel in ('email', 'discord', 'both')),

  -- Discord 50007(DM 차단) 감지 플래그 → 이메일 fallback + 마이페이지 배지
  discord_dm_blocked boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 한 Discord 계정은 한 사용자에게만 연결 (중복 연결 방지)
create unique index user_profiles_discord_user_id_key
  on public.user_profiles (discord_user_id)
  where discord_user_id is not null;

comment on table public.user_profiles is
  'Discord 연결 + 알림 경로. 행 부재 = email 기본값으로 간주';
comment on column public.user_profiles.notify_channel is
  'email | discord | both. Discord 미연결 사용자는 email';
comment on column public.user_profiles.discord_dm_blocked is
  'Discord 50007(DM 차단) 감지 시 true. 마이페이지 배지 + 이메일 fallback 트리거';

-- (updated_at 자동 갱신 트리거는 생략 — 앱에서 필요 시 값 지정.
--  Supabase SQL Editor의 dollar-quote 파싱 이슈 회피 + 본 기능에 불필요)

-- =========================================================
-- RLS: 본인 row만 read/insert/update
-- 워커/시스템(service_role)은 RLS 우회로 알림 라우팅 조회 + dm_blocked 마크
-- =========================================================
alter table public.user_profiles enable row level security;

create policy "user_profiles_own_select"
  on public.user_profiles for select
  using (user_id = auth.uid());

create policy "user_profiles_own_insert"
  on public.user_profiles for insert
  with check (user_id = auth.uid());

create policy "user_profiles_own_update"
  on public.user_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
