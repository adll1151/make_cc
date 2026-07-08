'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { rankCandidates, type ThumbSuggestion, type ThumbCandidate } from '../lib/thumbnail-suggest';
import { extractCandidateFrames, extractFrameBlob } from '../lib/thumbnail-extract';
import { loadFaceDetector, detectFrameFace } from '../lib/thumbnail-ai';

interface ThumbnailPanelProps {
  videoUrl: string | null;
  /** 다운로드 파일명 베이스 (영상 원본명) */
  fileName?: string;
  jobId: string;
  /** 회원 여부 — 포스터 지정은 회원 전용 */
  isMember?: boolean;
  /** 샘플 체험 모드 — 포스터 지정 숨김 */
  isSample?: boolean;
  /** 포스터 지정 성공 시 새 signed URL 전달 (편집기 <video poster> 갱신) */
  onPosterSet?: (url: string) => void;
}

type PanelState = 'idle' | 'loading' | 'ready' | 'empty';
type PosterState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 섬네일 추천 패널 (Design §4 m4·m5).
 * 영상에서 후보 프레임을 추출·채점해 베스트 1 + 후보 그리드를 제시하고,
 * 선택 컷을 커버 화질(PNG/WebP)로 다운로드한다. 순수 클라이언트($0·게스트 OK).
 * 신호 부족·디코드/CORS 실패 시 조용히 비표시.
 */
export function ThumbnailPanel({
  videoUrl,
  fileName,
  jobId,
  isMember,
  isSample,
  onPosterSet,
}: ThumbnailPanelProps) {
  const [state, setState] = useState<PanelState>('idle');
  const [suggestion, setSuggestion] = useState<ThumbSuggestion | null>(null);
  const [selected, setSelected] = useState<ThumbCandidate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [posterState, setPosterState] = useState<PosterState>('idle');

  const base = useMemo(() => {
    const name = (fileName ?? '').replace(/\.[^.]+$/, '').trim();
    return name || 'thumbnail';
  }, [fileName]);

  useEffect(() => {
    if (!videoUrl) return;
    const ctrl = new AbortController();
    setState('loading');
    setSuggestion(null);
    setSelected(null);
    (async () => {
      const frames = await extractCandidateFrames(videoUrl, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;

      // Tier A(휴리스틱) 즉시 렌더
      const base = rankCandidates(
        frames.map((f) => ({ timeMs: f.timeMs, image: f.image, dataUrl: f.previewDataUrl })),
      );
      if (!base.best) {
        setState('empty');
        return;
      }
      setSuggestion(base);
      setSelected(base.best);
      setState('ready');

      // Tier B(얼굴 감지) 강화 — 비차단·graceful. 실패/모델없음 → Tier A 유지.
      const detector = await loadFaceDetector();
      if (ctrl.signal.aborted || !detector) return;
      const withFace = [];
      for (const f of frames) {
        if (ctrl.signal.aborted) return;
        const face = await detectFrameFace(detector, f.image);
        withFace.push({ timeMs: f.timeMs, image: f.image, dataUrl: f.previewDataUrl, face });
      }
      if (ctrl.signal.aborted) return;
      const enhanced = rankCandidates(withFace);
      setSuggestion(enhanced);
      setSelected(
        (prev) => enhanced.candidates.find((c) => c.timeMs === prev?.timeMs) ?? enhanced.best,
      );
    })();
    return () => ctrl.abort();
  }, [videoUrl]);

  // 선택이 바뀌면 포스터 지정 상태 초기화
  useEffect(() => setPosterState('idle'), [selected]);

  // 신호 부족/실패/미시작 → 비표시
  if (state === 'idle' || state === 'empty') return null;

  const onSetPoster = async () => {
    if (!selected || !videoUrl || posterState === 'saving') return;
    setPosterState('saving');
    try {
      const blob = await extractFrameBlob(videoUrl, selected.timeMs, {
        type: 'image/webp',
        quality: 0.9,
      });
      if (!blob) return setPosterState('error');
      const form = new FormData();
      form.append('file', blob, 'thumbnail.webp');
      const res = await fetch(`/api/jobs/${jobId}/thumbnail`, { method: 'POST', body: form });
      if (!res.ok) return setPosterState('error');
      const json = await res.json().catch(() => null);
      setPosterState('saved');
      if (json?.data?.url) onPosterSet?.(json.data.url);
    } catch {
      setPosterState('error');
    }
  };

  const onDownload = async (type: 'image/png' | 'image/webp') => {
    if (!selected || !videoUrl || downloading) return;
    setDownloading(true);
    try {
      const blob = await extractFrameBlob(videoUrl, selected.timeMs, {
        type,
        quality: type === 'image/webp' ? 0.92 : undefined,
      });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}-thumbnail.${type === 'image/webp' ? 'webp' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="bento p-5 sm:p-6">
      <header className="mb-5 flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">섬네일 추천</h2>
        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          NEW
        </span>
        {suggestion?.tier === 'AB' && (
          <span
            className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
            title="AI 얼굴 감지로 정밀 추천"
          >
            AI 분석
          </span>
        )}
        <span className="ml-1 text-xs text-muted-foreground">영상에서 커버로 좋은 컷을 골라드려요</span>
      </header>

      {state === 'loading' ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="aspect-video w-full animate-pulse rounded-xl bg-card/50 sm:w-1/2" />
          <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-lg bg-card/40" />
            ))}
          </div>
        </div>
      ) : (
        selected &&
        suggestion && (
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* 선택된(기본=베스트) 컷 크게 */}
            <div className="sm:w-1/2">
              <div className="relative overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.dataUrl}
                  alt="추천 섬네일 미리보기"
                  className="aspect-video w-full object-cover"
                />
                {selected === suggestion.best && (
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                    ★ 추천
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ReasonChips cand={selected} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDownload('image/png')}
                  disabled={downloading}
                  className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {downloading ? '내보내는 중…' : 'PNG 다운로드'}
                </button>
                <button
                  type="button"
                  onClick={() => onDownload('image/webp')}
                  disabled={downloading}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border-strong hover:text-foreground disabled:opacity-50"
                >
                  WebP
                </button>
                {isMember && !isSample && (
                  <button
                    type="button"
                    onClick={onSetPoster}
                    disabled={posterState === 'saving'}
                    title="이 컷을 이 영상의 대표 이미지로 저장 (히스토리·미리보기에 표시)"
                    className={cn(
                      'ml-auto rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50',
                      posterState === 'saved'
                        ? 'border-accent/40 text-accent'
                        : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    {posterState === 'saving'
                      ? '지정 중…'
                      : posterState === 'saved'
                        ? '✓ 포스터로 지정됨'
                        : posterState === 'error'
                          ? '실패 · 다시'
                          : '이 컷을 포스터로'}
                  </button>
                )}
              </div>
            </div>

            {/* 후보 그리드 */}
            <div className="grid flex-1 grid-cols-3 gap-2 self-start sm:grid-cols-5">
              {suggestion.candidates.map((c) => (
                <button
                  key={c.timeMs}
                  type="button"
                  onClick={() => setSelected(c)}
                  title={`${(c.timeMs / 1000).toFixed(1)}초 · 점수 ${(c.score * 100).toFixed(0)}`}
                  className={cn(
                    'relative overflow-hidden rounded-lg border transition',
                    selected === c
                      ? 'border-accent ring-2 ring-accent/50'
                      : 'border-border/60 hover:border-border-strong',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.dataUrl} alt="" className="aspect-video w-full object-cover" />
                  {c === suggestion.best && (
                    <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[8px] font-bold text-accent-foreground">
                      ★
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </section>
  );
}

/** 후보의 강한 신호를 칩으로. Tier B(⭐미학·😀얼굴)는 signals에 있으면 함께 표시. */
function ReasonChips({ cand }: { cand: ThumbCandidate }) {
  const s = cand.signals;
  const chips: string[] = [];
  if (s.aesthetic != null) chips.push(`⭐ 미학 ${(s.aesthetic * 10).toFixed(1)}`);
  if (s.face) chips.push('😀 얼굴');
  if (s.sharpness > 0.6) chips.push('✨ 선명');
  if (s.colorfulness > 0.5) chips.push('🌈 색감');
  if (s.brightness > 0.7) chips.push('☀️ 밝기');
  if (chips.length === 0) chips.push(`점수 ${(cand.score * 100).toFixed(0)}`);
  return (
    <>
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {c}
        </span>
      ))}
    </>
  );
}
