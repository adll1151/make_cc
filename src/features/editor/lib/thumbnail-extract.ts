'use client';

import { once, waitForFrame } from './frame-sampler';

/**
 * 섬네일 추천 — 후보 프레임 추출 (DOM). Design §4 m1.
 *
 * 영상 URL을 전용 히든 <video crossOrigin=anonymous>로 로드해 균등 시점을 seek,
 * 다운스케일 canvas로 프레임을 뽑아 { 픽셀(채점용) + 미리보기 dataURL }을 반환한다.
 * frame-sampler와 동일한 crossOrigin·rVFC·taint/타임아웃 강등 로직을 공유(once/waitForFrame).
 *
 * 실패(CORS load error, taint SecurityError, 타임아웃, 디코드 불가) 시 빈 배열 →
 * 호출부(패널)는 무해하게 비표시. 참조: frame-sampler.ts, Design §6.
 */

export const DEFAULT_COUNT = 16;
export const DEFAULT_MAX_EDGE = 320;
export const DEFAULT_SKIP_EDGE = 0.05; // 양 끝(인트로/아웃트로) 스킵 비율
export const TIMEOUT_MS = 15_000; // 16 seek는 sampler(8)보다 여유 필요
export const PER_SEEK_TIMEOUT_MS = 1_500;
export const PREVIEW_QUALITY = 0.85;

export interface CandidateFrame {
  /** 프레임 시각(ms) */
  timeMs: number;
  /** 다운스케일 픽셀(ImageData) — Tier A 채점·얼굴 감지 입력 */
  image: ImageData;
  /** 미리보기용 data URL (webp, 미지원 시 png 폴백) */
  previewDataUrl: string;
  width: number;
  height: number;
}

export interface ExtractOptions {
  /** 후보 수 (기본 16) */
  count?: number;
  /** 긴 변 상한 px (기본 320) */
  maxEdge?: number;
  /** 양 끝 스킵 비율 (기본 0.05) */
  skipEdgePct?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** 균등 시점 fraction 배열 (skipEdge~1-skipEdge, count개). */
export function uniformFractions(count: number, skipEdgePct: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const lo = Math.min(0.49, Math.max(0, skipEdgePct));
  const span = 1 - 2 * lo;
  return Array.from({ length: count }, (_, i) => lo + (span * i) / (count - 1));
}

/**
 * videoUrl에서 후보 프레임을 추출. 실패/비-DOM 환경 → 빈 배열.
 */
export async function extractCandidateFrames(
  videoUrl: string | null | undefined,
  opts: ExtractOptions = {},
): Promise<CandidateFrame[]> {
  if (!videoUrl || typeof document === 'undefined') return [];

  const count = opts.count ?? DEFAULT_COUNT;
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const skipEdgePct = opts.skipEdgePct ?? DEFAULT_SKIP_EDGE;
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  const { signal } = opts;

  const video = document.createElement('video');
  // crossOrigin은 반드시 src 할당 전에 (frame-sampler §10.7과 동일)
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  video.setAttribute('aria-hidden', 'true');
  video.src = videoUrl;
  document.body.appendChild(video);

  const frames: CandidateFrame[] = [];

  try {
    await once(video, 'loadedmetadata', Math.max(0, deadline - Date.now()), signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return [];

    // 디코드 프라이밍(iOS): 짧게 재생 시도 후 정지 (실패 무시)
    try {
      await video.play();
      video.pause();
    } catch {
      /* autoplay 차단 등 — seek만으로 진행 */
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    const fractions = uniformFractions(count, skipEdgePct);
    for (const frac of fractions) {
      if (signal?.aborted || Date.now() >= deadline) break;
      const t = Math.min(duration * frac, Math.max(0, duration - 0.05));

      try {
        video.currentTime = t;
        await once(
          video,
          'seeked',
          Math.min(PER_SEEK_TIMEOUT_MS, Math.max(0, deadline - Date.now())),
          signal,
        );
        await waitForFrame(video);

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) continue;
        if (!canvas.width) {
          // 긴 변을 maxEdge로 다운스케일 (비율 유지)
          const scale = Math.min(1, maxEdge / Math.max(vw, vh));
          canvas.width = Math.max(1, Math.round(vw * scale));
          canvas.height = Math.max(1, Math.round(vh * scale));
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // cross-origin taint → getImageData/toDataURL이 SecurityError. 전체 중단(강등).
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let previewDataUrl: string;
        try {
          previewDataUrl = canvas.toDataURL('image/webp', PREVIEW_QUALITY);
        } catch {
          previewDataUrl = canvas.toDataURL(); // webp 미지원 → png 폴백
        }
        frames.push({
          timeMs: Math.round(t * 1000),
          image,
          previewDataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'SecurityError') {
          return []; // taint — 추출 불가
        }
        // 개별 seek 타임아웃/디코드 실패 → 이 프레임만 skip
      }
    }

    return frames;
  } catch {
    return []; // load error(CORS 미설정 등)·타임아웃·abort
  } finally {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}

export interface FrameBlobOptions {
  /** 긴 변 상한 px (기본 1280 — 커버 다운로드 화질). 원본보다 크게 확대하지 않음. */
  maxEdge?: number;
  /** MIME (기본 image/png) */
  type?: string;
  /** webp/jpeg quality 0~1 */
  quality?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * 지정 시각의 단일 프레임을 **고해상**으로 재추출해 Blob 반환 (m5 다운로드용).
 * 미리보기(≤320)와 달리 커버 화질(기본 ≤1280)로 뽑는다. 실패/taint → null.
 */
export async function extractFrameBlob(
  videoUrl: string | null | undefined,
  timeMs: number,
  opts: FrameBlobOptions = {},
): Promise<Blob | null> {
  if (!videoUrl || typeof document === 'undefined') return null;

  const maxEdge = opts.maxEdge ?? 1280;
  const type = opts.type ?? 'image/png';
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  const { signal } = opts;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  video.setAttribute('aria-hidden', 'true');
  video.src = videoUrl;
  document.body.appendChild(video);

  try {
    await once(video, 'loadedmetadata', Math.max(0, deadline - Date.now()), signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return null;

    try {
      await video.play();
      video.pause();
    } catch {
      /* autoplay 차단 — seek만으로 진행 */
    }

    const t = Math.min(Math.max(0, timeMs / 1000), Math.max(0, duration - 0.05));
    video.currentTime = t;
    await once(video, 'seeked', Math.min(PER_SEEK_TIMEOUT_MS, Math.max(0, deadline - Date.now())), signal);
    await waitForFrame(video);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // tainted canvas → toBlob이 SecurityError. Promise로 감싸고 실패 시 null.
    return await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), type, opts.quality);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}
