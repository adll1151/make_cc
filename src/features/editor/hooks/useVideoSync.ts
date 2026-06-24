'use client';

import { useEffect } from 'react';
import { useSubtitleStore } from './useSubtitleStore';

/**
 * <video>의 currentTime을 구독해 활성 cue idx를 store에 반영.
 * timeupdate 이벤트는 250ms~1000ms 간격이라 너무 무겁지 않음.
 */
export function useVideoSync(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const setActiveIndex = useSubtitleStore((s) => s.setActiveIndex);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    const update = () => {
      const cues = useSubtitleStore.getState().cues;
      const tMs = video.currentTime * 1000;
      // 단순 선형 탐색 (cues 1000개 이하 가정)
      let active: number | null = null;
      for (let i = 0; i < cues.length; i++) {
        const c = cues[i]!;
        if (tMs >= c.startMs && tMs < c.endMs) {
          active = i;
          break;
        }
        if (c.startMs > tMs) break; // 정렬 가정
      }
      setActiveIndex(active);
    };

    const onTimeUpdate = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', update);
    video.addEventListener('play', update);
    video.addEventListener('pause', update);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', update);
      video.removeEventListener('play', update);
      video.removeEventListener('pause', update);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [videoRef, setActiveIndex]);
}

/** cue 클릭 → 영상 seek */
export function seekToCue(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  startMs: number,
) {
  const video = videoRef.current;
  if (!video) return;
  video.currentTime = Math.max(0, startMs / 1000);
  // 자동 재생까지 욕심내면 사용자가 거부할 수 있음 → 그대로 두기
}

/**
 * 이 자막 구간만 재생: startMs로 이동 → 재생 → endMs 도달 시 자동 정지.
 * 자막 검수("이 구간만 다시 들어보기")용. 다른 곳을 다시 누르거나 사용자가
 * 직접 조작하면 기존 정지 핸들러는 스스로 해제된다.
 */
export function playCueSegment(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  startMs: number,
  endMs: number,
) {
  const video = videoRef.current;
  if (!video) return;

  // 이전 구간재생 정지 핸들러가 남아있으면 제거
  const prev = (video as HTMLVideoElement & { __cueStop?: () => void }).__cueStop;
  if (prev) prev();

  const stopAt = Math.max(0, endMs / 1000);
  const onTime = () => {
    if (video.currentTime >= stopAt) {
      video.pause();
      cleanup();
    }
  };
  const cleanup = () => {
    video.removeEventListener('timeupdate', onTime);
    video.removeEventListener('pause', onUserPause);
    delete (video as HTMLVideoElement & { __cueStop?: () => void }).__cueStop;
  };
  // 사용자가 도중에 직접 일시정지하면 구간재생 모드 해제
  const onUserPause = () => {
    if (video.currentTime < stopAt - 0.05) cleanup();
  };

  video.currentTime = Math.max(0, startMs / 1000);
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('pause', onUserPause);
  (video as HTMLVideoElement & { __cueStop?: () => void }).__cueStop = cleanup;
  void video.play().catch(() => cleanup());
}
