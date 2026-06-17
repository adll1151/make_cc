'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { ShareLinkCard } from '@/features/share';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { Cue } from '@/types/subtitle';
import { VideoPlayer } from './VideoPlayer';
import { CueList } from './CueList';
import { SaveStatusBadge } from './SaveStatusBadge';
import { CaptionPreview } from './CaptionPreview';
import { CaptionStylePanel } from './CaptionStylePanel';
import { ExportButton } from './ExportButton';
import { RenderProgress } from './RenderProgress';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { useAutoSave, saveNow } from '../hooks/useAutoSave';
import { useVideoSync, seekToCue } from '../hooks/useVideoSync';

interface EditorLayoutProps {
  jobId: string;
}

interface SubtitleResponse {
  jobId: string;
  language: string;
  cues: Cue[];
  updatedAt: string;
}

interface VideoUrlResponse {
  url: string;
  expiresIn: number;
}

export function EditorLayout({ jobId }: EditorLayoutProps) {
  const setLoaded = useSubtitleStore((s) => s.setLoaded);
  const reset = useSubtitleStore((s) => s.reset);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isMember, setIsMember] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 회원 여부 + ?share=1로 진입 시 자동 열기
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      setIsMember(!!data.user);
    })();
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('share') === '1'
    ) {
      setShowShare(true);
    }
  }, []);

  // 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [subRes, urlRes, jobRes] = await Promise.all([
          fetch(`/api/subtitles/${jobId}`),
          fetch(`/api/jobs/${jobId}/video-url`),
          fetch(`/api/jobs/${jobId}`),
        ]);

        if (!subRes.ok) {
          const j = await subRes.json().catch(() => ({}));
          throw new Error(j?.error?.message ?? '자막 로드 실패');
        }
        const subJson = (await subRes.json()) as { ok: true; data: SubtitleResponse };

        const jobJson = await jobRes.json().catch(() => null);
        const name = jobJson?.data?.videoOriginalName ?? '';

        if (cancelled) return;
        setLoaded({ jobId, cues: subJson.data.cues });
        setFileName(name);

        if (urlRes.ok) {
          const urlJson = (await urlRes.json()) as { ok: true; data: VideoUrlResponse };
          setVideoUrl(urlJson.data.url);
        } else {
          const j = await urlRes.json().catch(() => ({}));
          setVideoError(j?.error?.message ?? '영상 URL 발급 실패');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '데이터 로드 실패');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      reset();
    };
  }, [jobId, setLoaded, reset]);

  // 자동 저장
  useAutoSave();

  // 영상-자막 sync
  useVideoSync(videoRef);

  const onSeek = useCallback((startMs: number) => {
    seekToCue(videoRef, startMs);
  }, []);

  // 키보드 단축키 (전역)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 텍스트 편집 중에는 단축키 비활성
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loadError) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
        <FloatingNav />
        <section className="container mx-auto max-w-md px-6 pt-36">
          <div className="bento p-6 text-center">
            <p className="font-semibold text-destructive">데이터 로드 실패</p>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href="/upload">처음으로</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <FloatingNav />

      <div className="container mx-auto max-w-7xl px-4 pb-12 pt-32 sm:pt-36">
        {/* 헤더 */}
        <header className="enter-fade-up mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/upload"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              ← 다른 영상 올리기
            </Link>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {fileName || '자막 편집'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <SaveStatusBadge />
            {isMember && (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setShowShare((v) => !v)}
              >
                <ShareIcon />
                <span className="ml-1.5">{showShare ? '닫기' : '공유'}</span>
              </Button>
            )}
            <Button
              asChild
              variant="gradient"
              size="default"
            >
              <a href={`/api/subtitles/${jobId}/download`}>SRT 다운로드</a>
            </Button>
          </div>
        </header>

        {showShare && isMember && (
          <div className="mb-4">
            <ShareLinkCard jobId={jobId} />
          </div>
        )}

        {/* 그리드 — 좌:영상 / 우:자막 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          {/* 왼쪽: 영상 + 단축키 안내 */}
          <div className="space-y-3">
            <VideoPlayer
              ref={videoRef}
              src={videoUrl}
              loading={loading && !videoUrl}
              error={videoError}
              overlay={<CaptionPreview />}
            />
            <ActiveCueCard />
          </div>

          {/* 오른쪽: cue 리스트 */}
          <aside className="bento flex flex-col p-3 lg:max-h-[calc(100vh-200px)]">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h2 className="text-sm font-semibold text-muted-foreground">자막</h2>
              <ManualSaveButton />
            </div>
            <div className="custom-scroll flex-1 overflow-y-auto px-1 pb-1">
              {loading ? (
                <div className="space-y-2 px-2 py-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-card/40"
                    />
                  ))}
                </div>
              ) : (
                <CueList onSeek={onSeek} />
              )}
            </div>
          </aside>
        </div>

        {/* 번인 자막 스타일 + 내보내기 */}
        <section className="mt-6">
          <div className="bento p-5 sm:p-6">
            <header className="mb-5 flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">번인 자막 영상 만들기</h2>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                NEW
              </span>
            </header>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <CaptionStylePanel />
              <div className="lg:border-l lg:border-border lg:pl-6">
                <ExportButton jobId={jobId} />
                <RenderProgress />
              </div>
            </div>
          </div>
        </section>

        {/* 하단 단축키 안내 */}
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <Hint kbd="Space">재생/정지</Hint>
          <Hint kbd="Click">cue 시각으로 이동</Hint>
          <Hint kbd="Enter">편집 완료</Hint>
          <Hint kbd="Esc">편집 취소</Hint>
          <span>자동 저장 5초 디바운스</span>
        </footer>
      </div>
    </main>
  );
}

function ActiveCueCard() {
  const activeIndex = useSubtitleStore((s) => s.activeIndex);
  const cue = useSubtitleStore((s) => (activeIndex !== null ? s.cues[activeIndex] ?? null : null));

  if (!cue) {
    return (
      <div className="bento p-4 text-center text-xs text-muted-foreground">
        영상을 재생하면 현재 자막이 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div className="bento border-primary/30 bg-primary/5 p-4 text-center">
      <p className="text-lg leading-snug">{cue.text}</p>
    </div>
  );
}

function ManualSaveButton() {
  const dirty = useSubtitleStore((s) => s.dirty);
  const status = useSubtitleStore((s) => s.saveStatus);

  if (!dirty) return null;

  return (
    <button
      type="button"
      onClick={() => saveNow()}
      disabled={status === 'saving'}
      className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
    >
      {status === 'saving' ? '저장 중...' : '지금 저장'}
    </button>
  );
}

function Hint({ kbd, children }: { kbd: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground">
        {kbd}
      </kbd>
      {children}
    </span>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
