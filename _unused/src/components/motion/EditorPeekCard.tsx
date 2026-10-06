'use client';

import { EditorDemo } from '@/components/EditorDemo';

/**
 * "브라우저 편집기" 벤토 카드 — 호버하면 실제 편집기 UI를 닮은 큰 창이 펼쳐진다.
 * 평소엔 미니 데모(EditorDemo), 마우스 올리면 영상+자막 리스트+번인 스타일까지 보이는 미리보기.
 *
 * - 확장 창은 카드의 자손이라 호버가 유지됨(:hover가 descendant까지 적용) → 깜빡임 없음.
 * - overflow 클립을 피하려고 이 카드만 overflow-visible.
 */
export function EditorPeekCard({ className = '' }: { className?: string }) {
  return (
    <article
      className={`group relative z-10 flex min-h-[180px] flex-col justify-end rounded-2xl border border-border bg-[color-mix(in_oklab,var(--color-card)_80%,transparent)] p-6 backdrop-blur-md transition-all duration-300 hover:z-50 hover:border-border-strong ${className}`}
    >
      {/* 미니 데모 (평소) — 호버 시 살짝 흐려짐 */}
      <div className="transition-opacity duration-300 group-hover:opacity-30">
        <EditorDemo />
      </div>

      <div className="relative">
        <span className="mb-3 inline-block font-mono text-xs text-muted-foreground/60">02</span>
        <h3 className="text-xl font-bold tracking-tight">브라우저 편집기</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          미리보기 + 라인 단위 텍스트 수정.
          <span className="mt-1 block text-xs text-accent">↗ 마우스를 올려 실제 화면 보기</span>
        </p>
      </div>

      {/* ===== 호버 시 펼쳐지는 실제 편집기 미리보기 창 ===== */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-50 w-[600px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 scale-90 opacity-0 transition-all duration-300 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100"
        aria-hidden
      >
        <div className="overflow-hidden rounded-xl border border-border-strong bg-popover shadow-[0_24px_70px_-15px_rgba(0,0,0,0.7)] ring-1 ring-[color-mix(in_oklab,var(--color-primary)_25%,transparent)]">
          {/* 브라우저 크롬 */}
          <div className="flex items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 flex-1 truncate rounded-md bg-background/60 px-2 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
              make_cc / 편집기
            </span>
          </div>

          {/* 툴바 */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="truncate text-xs font-semibold">my-video.mp4</span>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                ✓ 저장됨
              </span>
              <span className="rounded bg-[linear-gradient(135deg,var(--color-primary),oklch(0.65_0.22_320))] px-2 py-0.5 text-[9px] font-semibold text-white">
                SRT 다운로드
              </span>
            </div>
          </div>

          {/* 본문: 영상 + 자막 리스트 */}
          <div className="grid grid-cols-[1fr_140px] gap-2 p-2.5">
            {/* 영상 */}
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <div className="absolute inset-0 aurora-subtle opacity-60" />
              <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              {/* 자막 오버레이 */}
              <span className="absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded bg-black/70 px-2 py-1 text-center text-[11px] font-semibold text-white">
                여기서 바로 수정하고
              </span>
              {/* 진행바 */}
              <div className="absolute inset-x-2 bottom-[2px] h-0.5 rounded-full bg-white/20">
                <div className="h-full w-1/3 rounded-full bg-accent" />
              </div>
            </div>

            {/* 자막 리스트 */}
            <div className="space-y-1.5">
              <p className="px-1 text-[9px] font-semibold uppercase text-muted-foreground/70">자막</p>
              {[
                { t: '0:01', s: '안녕하세요, 자막이에요', on: false },
                { t: '0:03', s: '여기서 바로 수정하고', on: true },
                { t: '0:05', s: '미리보기까지 실시간', on: false },
              ].map((c) => (
                <div
                  key={c.t}
                  className={`rounded-md border px-1.5 py-1 ${
                    c.on
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border/50 bg-card/40 opacity-70'
                  }`}
                >
                  <p className="font-mono text-[8px] text-muted-foreground/60">{c.t}</p>
                  <p className="truncate text-[10px] text-foreground/90">{c.s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 번인 스타일 힌트 */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <span className="text-[10px] font-semibold text-muted-foreground">번인 스타일</span>
            <div className="flex gap-1">
              {['bg-white text-black', 'bg-accent text-black', 'bg-black text-white border border-white/30'].map(
                (s, i) => (
                  <span
                    key={i}
                    className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${s}`}
                  >
                    가
                  </span>
                ),
              )}
            </div>
            <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              영상 만들기
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
