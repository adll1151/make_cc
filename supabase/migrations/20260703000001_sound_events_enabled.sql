-- 리치 CC(오디오 이벤트 태깅) on/off 잡 설정
-- 참조: docs/02-design/features/cc-rich-tagging.design.md
-- 기본 true(무료·기본 ON). false면 워커가 sound_events(AudioTagging)를 건너뛰고
-- 순수 대사 자막만 생성한다. (diarization_enabled와 동일 패턴)

alter table public.jobs
  add column if not exists sound_events_enabled boolean not null default true;

comment on column public.jobs.sound_events_enabled is
  '리치 CC(비음성 사운드 이벤트 태깅) 활성 여부. false면 대사 자막만 생성.';
