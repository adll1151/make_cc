import { describe, it, expect, beforeEach } from 'vitest';
import { useSubtitleStore } from '@/features/editor/hooks/useSubtitleStore';
import type { Cue } from '@/types/subtitle';

const cue = (index: number, startMs: number, endMs: number, text: string): Cue => ({
  index,
  startMs,
  endMs,
  text,
});

function load(cues: Cue[]) {
  useSubtitleStore.getState().setLoaded({ jobId: 'job-test', cues });
}

describe('useSubtitleStore — 리치 CC 수동 편집', () => {
  beforeEach(() => {
    useSubtitleStore.getState().reset();
  });

  describe('addSoundCueAfter', () => {
    it('간격이 있으면 kind=sound 큐(♪ 음악 ♪)를 삽입하고 선택+편집으로 진입', () => {
      load([cue(1, 0, 1000, '안녕하세요'), cue(2, 5000, 6000, '반갑습니다')]);
      useSubtitleStore.getState().addSoundCueAfter(1);

      const { cues, selectedIndex, editingIndex, dirty } = useSubtitleStore.getState();
      expect(cues).toHaveLength(3);
      const inserted = cues[1]!;
      expect(inserted.kind).toBe('sound');
      expect(inserted.text).toBe('♪ 음악 ♪');
      expect(inserted.startMs).toBe(1000); // 앞 cue의 endMs
      // 재인덱싱 확인
      expect(cues.map((c) => c.index)).toEqual([1, 2, 3]);
      expect(selectedIndex).toBe(1);
      expect(editingIndex).toBe(1);
      expect(dirty).toBe(true);
    });

    it('다음 cue와의 간격이 부족하면 삽입하지 않음', () => {
      load([cue(1, 0, 1000, '안녕'), cue(2, 1100, 2000, '하세요')]); // gap 100 < 200
      useSubtitleStore.getState().addSoundCueAfter(1);
      expect(useSubtitleStore.getState().cues).toHaveLength(2);
    });

    it('마지막 cue 뒤에는 항상 삽입 가능', () => {
      load([cue(1, 0, 1000, '끝 대사')]);
      useSubtitleStore.getState().addSoundCueAfter(1);
      const { cues } = useSubtitleStore.getState();
      expect(cues).toHaveLength(2);
      expect(cues[1]!.kind).toBe('sound');
    });
  });

  describe('addCueAfter — 대사 큐는 kind 미지정 유지', () => {
    it('삽입된 대사 큐는 kind가 없다', () => {
      load([cue(1, 0, 1000, '안녕'), cue(2, 5000, 6000, '하세요')]);
      useSubtitleStore.getState().addCueAfter(1);
      const inserted = useSubtitleStore.getState().cues[1]!;
      expect(inserted.kind).toBeUndefined();
      expect(inserted.text).toBe('새 자막');
    });
  });

  describe('updateCueText — 텍스트 표기로 kind 자동 파생', () => {
    it('대사 → [웃음] 편집 시 kind=sound 로 전환', () => {
      load([cue(1, 0, 1000, '안녕하세요')]);
      useSubtitleStore.getState().updateCueText(1, '[웃음]');
      expect(useSubtitleStore.getState().cues[0]!.kind).toBe('sound');
    });

    it('♪ 음악 ♪ 표기도 사운드로 인식', () => {
      load([cue(1, 0, 1000, '대사')]);
      useSubtitleStore.getState().updateCueText(1, '♪ 잔잔한 음악 ♪');
      expect(useSubtitleStore.getState().cues[0]!.kind).toBe('sound');
    });

    it('사운드 → 일반 텍스트 편집 시 대사로 복귀(kind 해제)', () => {
      load([{ ...cue(1, 0, 1000, '[웃음]'), kind: 'sound' }]);
      useSubtitleStore.getState().updateCueText(1, '하하 웃었다');
      expect(useSubtitleStore.getState().cues[0]!.kind).toBeUndefined();
    });

    it('다중 괄호 대사는 사운드로 오탐하지 않음', () => {
      load([cue(1, 0, 1000, '대사')]);
      useSubtitleStore.getState().updateCueText(1, '[웃으며] 안녕 [계속]');
      expect(useSubtitleStore.getState().cues[0]!.kind).toBeUndefined();
    });
  });
});
