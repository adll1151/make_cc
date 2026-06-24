-- =========================================================
-- subtitle-translation (m6): 번인 렌더 언어 선택
-- renders에 자막 언어 컬럼 추가. 기본 'ko'(원본). 번역 트랙 언어로 번인 가능.
-- 참조: docs/02-design/features/subtitle-translation.design.md §3.2
-- =========================================================

alter table public.renders
  add column if not exists subtitle_lang text not null default 'ko';

comment on column public.renders.subtitle_lang is
  '번인할 자막 언어(내부 코드). ko=원본, 그 외=translations 트랙. 워커 loadCuesForLang가 사용';
