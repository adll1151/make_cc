-- =========================================================
-- thumbnail-suggest m6: 사용자가 지정한 대표 섬네일(포스터) 영속
-- 참조: docs/02-design/features/thumbnail-suggest.design.md §3
-- =========================================================

alter table public.jobs
  add column if not exists thumbnail_path text;

comment on column public.jobs.thumbnail_path is
  '사용자가 지정한 대표 섬네일 이미지 경로(thumbnails 버킷). null=미지정.';

-- thumbnails 버킷 (private) — renders 선례(20260616000002)와 동일 방식.
-- storage RLS 정책은 두지 않는다(접근은 admin + 짧은 만료 signed URL로 강제).
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', false)
on conflict (id) do nothing;
