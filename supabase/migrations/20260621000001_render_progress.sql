-- =========================================================
-- burnin-captions: 렌더 진행률(%) 컬럼 추가
-- 워커 ffmpeg -progress 파싱 → progress_percent 갱신 → SSE로 실시간 표시
-- =========================================================

alter table public.renders
  add column if not exists progress_percent int not null default 0
    check (progress_percent between 0 and 100);

comment on column public.renders.progress_percent is
  '번인 렌더 진행률 0~100. 워커가 ffmpeg out_time/duration으로 갱신, done 시 100';
