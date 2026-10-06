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

describe('useSubtitleStore — 되돌리기/다시 실행', () => {
  beforeEach(() => {
    useSubtitleStore.getState().reset();
  });

  const texts = () => useSubtitleStore.getState().cues.map((c) => c.text);

  it('텍스트 수정을 undo하면 원래 텍스트·dirty=false로 복귀, redo로 재적용', () => {
    load([cue(1, 0, 1000, '안녕'), cue(2, 2000, 3000, '하세요')]);
    const st = useSubtitleStore.getState();
    st.updateCueText(1, '안녕!');
    expect(texts()).toEqual(['안녕!', '하세요']);

    useSubtitleStore.getState().undo();
    expect(texts()).toEqual(['안녕', '하세요']);
    expect(useSubtitleStore.getState().dirty).toBe(false);

    useSubtitleStore.getState().redo();
    expect(texts()).toEqual(['안녕!', '하세요']);
    expect(useSubtitleStore.getState().dirty).toBe(true);
  });

  it('삭제·추가·타이밍 변경을 순서대로 되돌린다', () => {
    load([cue(1, 0, 1000, 'A'), cue(2, 5000, 6000, 'B')]);
    const s = () => useSubtitleStore.getState();
    s().updateCueTiming(1, 0, 1500);
    s().addCueAfter(1);
    s().deleteCue(1);
    expect(texts()).toEqual(['새 자막', 'B']);

    s().undo(); // 삭제 취소
    expect(texts()).toEqual(['A', '새 자막', 'B']);
    s().undo(); // 추가 취소
    expect(texts()).toEqual(['A', 'B']);
    s().undo(); // 타이밍 취소
    expect(s().cues[0]!.endMs).toBe(1000);
    expect(s().past).toHaveLength(0);
  });

  it('undo 후 새 편집을 하면 redo 갈래가 사라진다', () => {
    load([cue(1, 0, 1000, 'A')]);
    const s = () => useSubtitleStore.getState();
    s().updateCueText(1, 'B');
    s().undo();
    s().updateCueText(1, 'C');
    expect(s().future).toHaveLength(0);
    s().redo();
    expect(texts()).toEqual(['C']);
  });

  it('스택이 비어 있으면 undo/redo는 무시, 새 로드 시 히스토리 초기화', () => {
    load([cue(1, 0, 1000, 'A')]);
    const s = () => useSubtitleStore.getState();
    s().undo();
    s().redo();
    expect(texts()).toEqual(['A']);
    s().updateCueText(1, 'B');
    load([cue(1, 0, 1000, 'X')]);
    expect(s().past).toHaveLength(0);
    expect(s().future).toHaveLength(0);
  });

  it('값이 그대로인 타이밍 변경은 히스토리에 쌓지 않는다', () => {
    load([cue(1, 0, 1000, 'A')]);
    useSubtitleStore.getState().updateCueTiming(1, 0, 1000);
    expect(useSubtitleStore.getState().past).toHaveLength(0);
  });
});
