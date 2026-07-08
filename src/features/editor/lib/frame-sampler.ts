'use client';

import {
  analyzeFrameRegion,
  aggregateFrameSignals,
  type CaptionBand,
  type FrameSignals,
  type RegionStats,
} from './frame-analysis';

/**
 * 자막 스타일 어시(Tier 2) 프레임 샘플러 — DOM.
 *
 * 영상 URL을 전용 히든 <video crossOrigin=anonymous>로 로드해 여러 시점을 seek,
 * 초소형 canvas로 프레임을 뽑아 analyzeFrameRegion → aggregate 한다.
 * 재생 중인 영상과 완전히 분리(seek 끊김·CORS 리스크 격리).
 *
 * 실패(CORS load error, taint SecurityError, 타임아웃, 디코드 불가) 시 null →
 * 호출부는 Tier 1으로 무해 강등. 참조: Design §4.2, §6, §10.5, §10.7
 */

export const SAMPLE_COUNT = 8;
export const MAX_WIDTH = 160;
export const TIMEOUT_MS = 4000;
export const PER_SEEK_TIMEOUT_MS = 1200;

export interface SampleOptions {
  count?: number;
  maxWidth?: number;
  timeoutMs?: number;
  /** 현재 자막 위치 기준 분석 밴드. 'middle'은 호출부에서 'bottom'으로 매핑. */
  band: CaptionBand;
  signal?: AbortSignal;
}

/** el의 event를 1회 대기. 타임아웃/abort 시 reject. (thumbnail-extract 등과 공유) */
export function once(
  el: HTMLElement,
  event: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const cleanup = () => {
      el.removeEventListener(event, onEvent);
      el.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`${event}: media error`));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('aborted'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${event}: timeout`));
    }, timeoutMs);
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * seek 후 프레임 페인트 확정을 기다린다(rVFC 우선, 없으면 rAF).
 * 히든/오프스크린 비디오는 컴포지터에 프레임을 표시하지 않아 rVFC가 영영 안 올 수 있으므로
 * 반드시 타임아웃 폴백을 둔다. 'seeked' 이후엔 currentTime 프레임이 drawImage로 그릴 수 있다.
 */
export function waitForFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const rvfc = (video as { requestVideoFrameCallback?: (cb: () => void) => number })
      .requestVideoFrameCallback;
    if (typeof rvfc === 'function') rvfc.call(video, finish);
    else requestAnimationFrame(finish);
    setTimeout(finish, 250); // rVFC/rAF가 오지 않는 오프스크린 대비
  });
}

/**
 * videoUrl에서 프레임을 샘플링해 FrameSignals 반환. 실패 시 null.
 * 서버/비-DOM 환경에서는 즉시 null.
 */
export async function sampleFrameSignals(
  videoUrl: string | null | undefined,
  opts: SampleOptions,
): Promise<FrameSignals | null> {
  if (!videoUrl || typeof document === 'undefined') return null;

  const count = opts.count ?? SAMPLE_COUNT;
  const maxWidth = opts.maxWidth ?? MAX_WIDTH;
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  const { signal, band } = opts;

  const video = document.createElement('video');
  // crossOrigin은 반드시 src 할당 전에 (이후 설정은 재로드/무음 taint 유발 §10.7)
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  // iOS Safari는 offscreen 비디오 프레임 페인트를 거부할 수 있어 visually-hidden으로 DOM 부착 (§10.5)
  video.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  video.setAttribute('aria-hidden', 'true');
  video.src = videoUrl;
  document.body.appendChild(video);

  const stats: RegionStats[] = [];

  try {
    await once(video, 'loadedmetadata', Math.max(0, deadline - Date.now()), signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return null;

    // 디코드 프라이밍(iOS): 짧게 재생 시도 후 정지 (실패 무시)
    try {
      await video.play();
      video.pause();
    } catch {
      /* autoplay 차단 등 — seek만으로 진행 */
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    for (let i = 0; i < count; i++) {
      if (signal?.aborted || Date.now() >= deadline) break;
      // 양 끝 5%~95% 균등 시점
      const frac = count === 1 ? 0.5 : 0.05 + (0.9 * i) / (count - 1);
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
          canvas.width = Math.min(maxWidth, vw);
          canvas.height = Math.max(1, Math.round((canvas.width * vh) / vw));
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // cross-origin taint → getImageData가 SecurityError. catch 후 전체 중단(§10.7)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        stats.push(analyzeFrameRegion(image, band));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'SecurityError') {
          return null; // taint — Tier 2 불가, Tier 1 강등
        }
        // 개별 seek 타임아웃/디코드 실패 → 이 프레임만 skip
      }
    }

    return aggregateFrameSignals(stats, band);
  } catch {
    return null; // load error(CORS 미설정 등)·타임아웃·abort
  } finally {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}
