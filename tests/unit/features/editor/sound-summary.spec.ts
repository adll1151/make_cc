import { describe, it, expect } from 'vitest';
import { summarizeSoundCues, formatSoundSummary } from '@/features/editor/lib/sound-summary';
import type { Cue } from '@/types/subtitle';

const speech = (i: number, text: string): Cue => ({
  index: i,
  startMs: i * 1000,
  endMs: i * 1000 + 800,
  text,
});
const sound = (i: number, text: string): Cue => ({ ...speech(i, text), kind: 'sound' });

describe('summarizeSoundCues', () => {
  it('사운드 큐만 표기별 집계, count 내림차순', () => {
    const cues: Cue[] = [
      speech(1, '안녕하세요'),
      sound(2, '♪ 음악 ♪'),
      sound(3, '[웃음]'),
      sound(4, '♪ 음악 ♪'),
      speech(5, '반갑습니다'),
      sound(6, '♪ 음악 ♪'),
      sound(7, '[웃음]'),
    ];
    expect(summarizeSoundCues(cues)).toEqual([
      { label: '♪ 음악 ♪', count: 3 },
      { label: '[웃음]', count: 2 },
    ]);
  });

  it('동수는 라벨순(localeCompare) 안정 정렬', () => {
    const cues: Cue[] = [sound(1, '[박수]'), sound(2, '[웃음]')];
    const out = summarizeSoundCues(cues);
    expect(out.map((e) => e.count)).toEqual([1, 1]);
    expect(out.map((e) => e.label)).toEqual(['[박수]', '[웃음]']);
  });

  it('사운드 큐 없으면 빈 배열 / 빈 문자열', () => {
    const cues: Cue[] = [speech(1, '대사만'), speech(2, '더 있음')];
    expect(summarizeSoundCues(cues)).toEqual([]);
    expect(formatSoundSummary(cues)).toBe('');
  });

  it('formatSoundSummary — 한 줄 요약', () => {
    const cues: Cue[] = [sound(1, '♪ 음악 ♪'), sound(2, '♪ 음악 ♪'), sound(3, '[박수]')];
    expect(formatSoundSummary(cues)).toBe('♪ 음악 ♪ 2 · [박수] 1');
  });
});
