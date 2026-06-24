-- =========================================================
-- subtitle-translation: translations (자막 다국어 번역 트랙)
-- 참조: docs/02-design/features/subtitle-translation.design.md §3
-- renders 도메인을 미러(상태머신 pending→translating→done/failed).
-- 번역본 SRT는 subtitles 버킷에 {jobId}.{lang}.srt로 저장(별도 버킷 불필요).
-- =========================================================

create table public.translations (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'translating', 'done', 'failed')),

  source_lang text not null default 'ko',
  target_lang text not null,            -- 내부 코드 (en/ja/zh ...)
  engine text not null default 'deepl',

  output_storage_key text,              -- {yyyy}/{mm}/{jobId}/{jobId}.{target_lang}.srt
  char_count int,                       -- 번역 문자 수(비용 추적)
  error_code text,
  error_message text,
  progress_percent int not null default 0,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  output_delete_at timestamptz
);

create index translations_job_idx on public.translations (job_id, created_at desc);
create index translations_status_idx on public.translations (status);
create index translations_delete_at_idx on public.translations (output_delete_at)
  where output_delete_at is not null;

-- 같은 잡+언어 1건만 (재번역은 기존 행 재사용/리셋)
create unique index translations_job_lang_uniq on public.translations (job_id, target_lang);

-- RLS: 본인(회원) 잡의 번역만 조회. 워커/시스템 쓰기는 admin(service_role) 우회.
alter table public.translations enable row level security;

create policy "translations_owner_select"
  on public.translations for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = translations.job_id
        and j.owner_type = 'user'
        and j.user_id = auth.uid()
    )
  );

comment on table public.translations is '자막 다국어 번역 트랙. STT(jobs)·렌더(renders)와 별개 생명주기';
comment on column public.translations.target_lang is '내부 언어코드. DeepL 코드 매핑은 services/translation/languages.ts';
