'use client';

import { create } from 'zustand';
import type { Cue, SpeakerMap } from '@/types/subtitle';

/**
 * 편집기 클라이언트 상태.
 *
 * - cues: 현재 자막 (편집 반영)
 * - dirty: 마지막 저장 이후 변경 여부 (자동 저장이 감시)
 * - activeIndex: 현재 영상 시간에 해당하는 cue (useVideoSync가 갱신)
 * - saveStatus: idle | saving | saved | error
 */
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SubtitleStore {
  jobId: string | null;
  cues: Cue[];
  /** 화자 표시 이름 맵 (spk_0 → '화자 1'/'김지훈'). 화자 미분리면 빈 객체. */
  speakerMap: SpeakerMap;
  /** 최초 로드된 cues — 변경 비교용 */
  originalSignature: string;
  /** 현재 cues signature */
  signature: string;
  dirty: boolean;
  activeIndex: number | null;
  saveStatus: SaveStatus;
  lastSaveError: string | null;
  lastSavedAt: number | null;

  /** 최초 데이터 로드 */
  setLoaded(params: { jobId: string; cues: Cue[]; speakerMap?: SpeakerMap }): void;
  /** 화자 표시 이름 맵 갱신 (이름 변경 시) */
  setSpeakerMap(map: SpeakerMap): void;
  /** cue 텍스트 수정 */
  updateCueText(index: number, text: string): void;
  /** 활성 cue idx 설정 (useVideoSync 호출) */
  setActiveIndex(idx: number | null): void;
  /** 저장 시작 마킹 */
  markSaving(): void;
  /** 저장 완료 마킹 (signature 갱신) */
  markSaved(): void;
  /** 저장 실패 */
  markSaveError(message: string): void;
  /** 리셋 (잡 전환) */
  reset(): void;
}

function computeSignature(cues: Cue[]): string {
  // 텍스트만 변경 감시 (타임코드 readonly). 빠른 비교용.
  return cues.map((c) => c.text).join('');
}

export const useSubtitleStore = create<SubtitleStore>((set, get) => ({
  jobId: null,
  cues: [],
  speakerMap: {},
  originalSignature: '',
  signature: '',
  dirty: false,
  activeIndex: null,
  saveStatus: 'idle',
  lastSaveError: null,
  lastSavedAt: null,

  setLoaded({ jobId, cues, speakerMap }) {
    const sig = computeSignature(cues);
    set({
      jobId,
      cues,
      speakerMap: speakerMap ?? {},
      originalSignature: sig,
      signature: sig,
      dirty: false,
      activeIndex: null,
      saveStatus: 'idle',
      lastSaveError: null,
      lastSavedAt: null,
    });
  },

  setSpeakerMap(map) {
    set({ speakerMap: map });
  },

  updateCueText(index, text) {
    const cues = get().cues;
    const idx = cues.findIndex((c) => c.index === index);
    if (idx < 0) return;
    const nextCues = cues.slice();
    nextCues[idx] = { ...nextCues[idx]!, text };
    const nextSig = computeSignature(nextCues);
    const isDirty = nextSig !== get().originalSignature;
    set({
      cues: nextCues,
      signature: nextSig,
      dirty: isDirty,
      saveStatus: isDirty ? 'dirty' : 'saved',
    });
  },

  setActiveIndex(idx) {
    if (idx === get().activeIndex) return;
    set({ activeIndex: idx });
  },

  markSaving() {
    set({ saveStatus: 'saving', lastSaveError: null });
  },

  markSaved() {
    const sig = get().signature;
    set({
      originalSignature: sig,
      dirty: false,
      saveStatus: 'saved',
      lastSavedAt: Date.now(),
      lastSaveError: null,
    });
  },

  markSaveError(message) {
    set({ saveStatus: 'error', lastSaveError: message });
  },

  reset() {
    set({
      jobId: null,
      cues: [],
      speakerMap: {},
      originalSignature: '',
      signature: '',
      dirty: false,
      activeIndex: null,
      saveStatus: 'idle',
      lastSaveError: null,
      lastSavedAt: null,
    });
  },
}));
