import { describe, it, expect } from 'vitest';
import type { Cue } from '@/types/subtitle';
import {
  computeCps,
  orientationFromDimensions,
  extractCaptionSignals,
} from '@/features/editor/lib/caption-signals';
import { suggestCaptionStyle } from '@/features/editor/lib/caption-suggest';

const cue = (text: string, durMs: number, i = 1, speakerId?: string): Cue => ({
  index: i,
  startMs: i * 100000,
  endMs: i * 100000 + durMs,
  text,
  speakerId,
});
const many = (n: number, text: string, durMs: number): Cue[] =>
  Array.from({ length: n }, (_, i) => cue(text, durMs, i + 1));

const FAST = 'A'.repeat(40); // 40자 / 1s = 40 CPS (>17)
const SLOW = '안녕하세요'; // 5자 / 2s = 2.5 CPS
const portrait = { width: 1080, height: 1920 };
const landscape = { width: 1920, height: 1080 };

describe('computeCps', () => {
  it('공백 제외 글자수 / 초', () => {
    expect(computeCps('안녕 하세요', 1000)).toBe(5);
    expect(computeCps('hello', 0)).toBe(0);
    expect(computeCps('hello', -10)).toBe(0);
  });
});

describe('orientationFromDimensions', () => {
  it('세로/가로/정사각/무효 분류', () => {
    expect(orientationFromDimensions(1080, 1920)).toBe('portrait');
    expect(orientationFromDimensions(1920, 1080)).toBe('landscape');
    expect(orientationFromDimensions(1000, 1000)).toBe('square');
    expect(orientationFromDimensions(0, 100)).toBeNull();
    expect(orientationFromDimensions(NaN, 100)).toBeNull();
  });
});

describe('extractCaptionSignals', () => {
  it('CPS 분포·화자수·길이 집계', () => {
    const cues = [cue(FAST, 1000, 1, 'spk_0'), cue(SLOW, 2000, 2, 'spk_1')];
    const s = extractCaptionSignals(cues, { spk_0: '화자 1', spk_1: '화자 2' }, portrait);
    expect(s.cueCount).toBe(2);
    expect(s.orientation).toBe('portrait');
    expect(s.speakerCount).toBe(2);
    expect(s.highCpsRatio).toBeCloseTo(0.5); // 1 of 2 cues > 17
    expect(s.totalDurationSec).toBe(3);
  });

  it('영상 크기 없으면 orientation=null', () => {
    expect(extractCaptionSignals([cue(SLOW, 2000)]).orientation).toBeNull();
  });
});

describe('suggestCaptionStyle', () => {
  it('자막 없으면 null', () => {
    expect(suggestCaptionStyle(extractCaptionSignals([]))).toBeNull();
  });

  it('세로 + 말 빠름 → 굵은 노랑(high)', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(4, FAST, 1000), {}, portrait));
    expect(s?.presetKey).toBe('bold-yellow');
    expect(s?.confidence).toBe('high');
    expect(s?.reasons.length).toBeGreaterThan(0);
  });

  it('세로 + 느림 → 예능', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(4, SLOW, 2000), {}, portrait));
    expect(s?.presetKey).toBe('variety');
  });

  it('가로 + 짧음 → 기본', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(5, SLOW, 2000), {}, landscape));
    expect(s?.presetKey).toBe('basic');
  });

  it('가로 + 긴 영상(>60 cue) → 상단', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(61, SLOW, 2000), {}, landscape));
    expect(s?.presetKey).toBe('top-clean');
  });

  it('종횡비 미상 + 빠름 → 굵은 노랑(low confidence)', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(4, FAST, 1000), {}));
    expect(s?.presetKey).toBe('bold-yellow');
    expect(s?.confidence).toBe('low');
  });

  it('화자 2명+ → hint 노출', () => {
    const cues = [cue(SLOW, 2000, 1, 'spk_0'), cue(SLOW, 2000, 2, 'spk_1')];
    const s = suggestCaptionStyle(extractCaptionSignals(cues, {}, landscape));
    expect(s?.hint).toMatch(/화자가 2명/);
  });

  it('고CPS 비율↑ → 박스 배경 근거 추가', () => {
    const s = suggestCaptionStyle(extractCaptionSignals(many(4, FAST, 1000), {}, portrait));
    expect(s?.reasons.some((r) => r.includes('박스'))).toBe(true);
  });
});
