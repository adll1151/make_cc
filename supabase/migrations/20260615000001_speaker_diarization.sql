-- =========================================================
-- 0002: speaker diarization (화자 분리) 컬럼 추가
-- 참조: docs/02-design/features/speaker-diarization.design.md §3.2
-- =========================================================

alter table public.jobs
  add column if not exists speaker_map jsonb not null default '{}'::jsonb,
  add column if not exists diarization_enabled boolean not null default true;

comment on column public.jobs.speaker_map is
  '화자 ID → 표시 이름 매핑 (Record<string, string>). 빈 객체는 1인 영상 또는 라벨 미사용';

comment on column public.jobs.diarization_enabled is
  '워커가 이 잡에 화자 분리를 수행할지 여부. 기본 true, .env로 전역 끔 가능';

-- 인덱스 불필요 — 조회는 단건 by id, JSONB 검색 안 함
-- RLS 영향 없음 — 기존 정책이 컬럼별이 아닌 행 단위
