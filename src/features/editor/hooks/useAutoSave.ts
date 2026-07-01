'use client';

import { useEffect, useRef } from 'react';
import { useSubtitleStore } from './useSubtitleStore';

const DEBOUNCE_MS = 5_000;

/**
 * 5초 디바운스 자동 저장.
 *
 * dirty=true가 되면 5초 후 PUT /api/subtitles/[jobId] 호출.
 * 5초 안에 또 변경되면 타이머 리셋.
 * 페이지 unmount 시 즉시 저장 시도(beacon).
 */
export function useAutoSave() {
  const jobId = useSubtitleStore((s) => s.jobId);
  const dirty = useSubtitleStore((s) => s.dirty);
  const cues = useSubtitleStore((s) => s.cues);
  const markSaving = useSubtitleStore((s) => s.markSaving);
  const markSaved = useSubtitleStore((s) => s.markSaved);
  const markSaveError = useSubtitleStore((s) => s.markSaveError);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  // 디바운스 트리거
  useEffect(() => {
    // 'sample' = 가입 전 체험 모드 — 서버 저장하지 않음
    if (!dirty || !jobId || jobId === 'sample') return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      markSaving();
      try {
        const res = await fetch(`/api/subtitles/${jobId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cues }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          markSaveError(json?.error?.message ?? `저장 실패 (HTTP ${res.status})`);
          return;
        }
        markSaved();
      } catch (err) {
        markSaveError(err instanceof Error ? err.message : '네트워크 오류');
      } finally {
        inFlightRef.current = false;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, jobId, cues, markSaving, markSaved, markSaveError]);

  // 페이지 떠날 때 미저장 변경 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useSubtitleStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}

/** 수동 저장 — 사용자가 "지금 저장" 버튼 누를 때 */
export async function saveNow(): Promise<void> {
  const state = useSubtitleStore.getState();
  if (!state.jobId || state.jobId === 'sample' || !state.dirty) return;
  state.markSaving();
  try {
    const res = await fetch(`/api/subtitles/${state.jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cues: state.cues }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      state.markSaveError(json?.error?.message ?? `저장 실패 (HTTP ${res.status})`);
      return;
    }
    state.markSaved();
  } catch (err) {
    state.markSaveError(err instanceof Error ? err.message : '네트워크 오류');
  }
}
