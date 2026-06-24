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
  /** 영상 재생 위치에 해당하는 cue idx (useVideoSync가 갱신) */
  activeIndex: number | null;
  /** 키보드/클릭으로 선택된 cue idx (편집 대상) */
  selectedIndex: number | null;
  /** 현재 편집 중인 cue idx. null이면 편집 안 함 (CueItem이 구독) */
  editingIndex: number | null;
  saveStatus: SaveStatus;
  lastSaveError: string | null;
  lastSavedAt: number | null;

  /** 최초 데이터 로드 */
  setLoaded(params: { jobId: string; cues: Cue[]; speakerMap?: SpeakerMap }): void;
  /** 화자 표시 이름 맵 갱신 (이름 변경 시) */
  setSpeakerMap(map: SpeakerMap): void;
  /** cue 텍스트 수정 */
  updateCueText(index: number, text: string): void;
  /** cue 타임코드 수정 (이웃 경계로 clamp — 겹침/역전 방지) */
  updateCueTiming(index: number, startMs: number, endMs: number): void;
  /** cue 삭제 (재인덱싱). 최소 1개는 유지 */
  deleteCue(index: number): void;
  /** 해당 cue 뒤(간격)에 새 자막 삽입. 간격 없으면 무시. 새 cue를 선택+편집 */
  addCueAfter(index: number): void;
  /** 활성 cue idx 설정 (useVideoSync 호출) */
  setActiveIndex(idx: number | null): void;
  /** 선택 cue idx 설정 (클릭/키보드) */
  setSelectedIndex(idx: number | null): void;
  /** 편집 cue idx 설정 (편집 진입/이탈/다음으로 이동) */
  setEditingIndex(idx: number | null): void;
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
  return cues.map((c) => `${c.startMs}|${c.endMs}|${c.text}`).join('');
}

const MIN_GAP_MS = 200; // 자막 삽입에 필요한 최소 간격
const NEW_CUE_MS = 2000; // 새 자막 기본 길이

/** cues 배열 → dirty 재계산 set 페이로드 (구조 변경 공통). */
function recomputed(cues: Cue[], originalSignature: string) {
  const sig = computeSignature(cues);
  const dirty = sig !== originalSignature;
  return { cues, signature: sig, dirty, saveStatus: (dirty ? 'dirty' : 'saved') as SaveStatus };
}

export const useSubtitleStore = create<SubtitleStore>((set, get) => ({
  jobId: null,
  cues: [],
  speakerMap: {},
  originalSignature: '',
  signature: '',
  dirty: false,
  activeIndex: null,
  selectedIndex: null,
  editingIndex: null,
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
      selectedIndex: null,
      editingIndex: null,
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

  updateCueTiming(index, startMs, endMs) {
    const cues = get().cues;
    const i = cues.findIndex((c) => c.index === index);
    if (i < 0) return;
    const lo = i > 0 ? cues[i - 1]!.endMs : 0;
    const hi = i < cues.length - 1 ? cues[i + 1]!.startMs : Number.MAX_SAFE_INTEGER;
    let s = Math.max(lo, Math.max(0, Math.round(startMs)));
    let e = Math.min(hi, Math.round(endMs));
    if (s >= e) {
      // 최소 1ms 확보 (이웃 경계 내에서)
      if (e - 1 >= lo) s = e - 1;
      else if (s + 1 <= hi) e = s + 1;
      else return; // 공간 없음
    }
    const next = cues.slice();
    next[i] = { ...next[i]!, startMs: s, endMs: e };
    set(recomputed(next, get().originalSignature));
  },

  deleteCue(index) {
    const cues = get().cues;
    if (cues.length <= 1) return; // 최소 1개 유지 (PUT min 1)
    const i = cues.findIndex((c) => c.index === index);
    if (i < 0) return;
    const next = cues.filter((_, k) => k !== i).map((c, k) => ({ ...c, index: k + 1 }));
    const sel = get().selectedIndex;
    const newSel = sel === null ? null : Math.min(sel, next.length - 1);
    set({ ...recomputed(next, get().originalSignature), selectedIndex: newSel, editingIndex: null });
  },

  addCueAfter(index) {
    const cues = get().cues;
    const i = cues.findIndex((c) => c.index === index);
    if (i < 0) return;
    const cur = cues[i]!;
    const nextCue = cues[i + 1];
    const s = cur.endMs;
    let e: number;
    if (nextCue) {
      const gap = nextCue.startMs - cur.endMs;
      if (gap < MIN_GAP_MS) return; // 간격 부족 → 삽입 불가
      e = cur.endMs + Math.min(NEW_CUE_MS, gap);
    } else {
      e = cur.endMs + NEW_CUE_MS;
    }
    const arr = cues.slice();
    arr.splice(i + 1, 0, { index: 0, startMs: s, endMs: e, text: '새 자막' });
    const next = arr.map((c, k) => ({ ...c, index: k + 1 }));
    set({
      ...recomputed(next, get().originalSignature),
      selectedIndex: i + 1,
      editingIndex: i + 1,
    });
  },

  setActiveIndex(idx) {
    if (idx === get().activeIndex) return;
    set({ activeIndex: idx });
  },

  setSelectedIndex(idx) {
    if (idx === get().selectedIndex) return;
    set({ selectedIndex: idx });
  },

  setEditingIndex(idx) {
    set({ editingIndex: idx });
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
      selectedIndex: null,
      editingIndex: null,
      saveStatus: 'idle',
      lastSaveError: null,
      lastSavedAt: null,
    });
  },
}));
