import { describe, it, expect } from 'vitest';
import type { Cue } from '@/types/subtitle';
import {
  wrapText,
  extendCueTimings,
  fitTranslatedCues,
  MAX_LINE_CHARS,
} from '../../../worker/lib/subtitle-fit';

describe('wrapText', () => {
  it('짧은 줄은 그대로 (1줄)', () => {
    expect(wrapText('Hello world')).toBe('Hello world');
  });

  it('연속 공백 정규화', () => {
    expect(wrapText('Hello   world')).toBe('Hello world');
  });

  it('긴 줄은 가운데 어절에서 2줄로 균형 분할', () => {
    const t = 'When you upload a video closed captions are generated automatically';
    const out = wrapText(t);
    const lines = out.split('\n');
    expect(lines.length).toBe(2);
    // 각 줄이 권장 길이 이내
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(MAX_LINE_CHARS);
    // 내용 보존(공백/줄바꿈 무시)
    expect(out.replace(/\n/g, ' ')).toBe(t);
  });

  it('아주 긴 텍스트는 greedy로 여러 줄', () => {
    const t = Array.from({ length: 40 }, () => 'word').join(' ');
    const out = wrapText(t);
    const lines = out.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(MAX_LINE_CHARS);
  });
});

function cue(index: number, startMs: number, endMs: number, text: string): Cue {
  return { index, startMs, endMs, text };
}

describe('extendCueTimings', () => {
  it('CPS 높은 cue의 종료를 뒤 간격까지 연장', () => {
    // 30자, 1초 → 30 CPS (목표 15 초과). 다음 cue는 5초에 시작 → 연장 여지 큼
    const cues = [
      cue(1, 0, 1000, 'a'.repeat(30)),
      cue(2, 5000, 6000, 'next'),
    ];
    const out = extendCueTimings(cues, 6000);
    // 30자/15cps = 2초 필요 → 종료 2000ms로 연장 (다음 5000-80 이내)
    expect(out[0]!.endMs).toBe(2000);
    expect(out[0]!.startMs).toBe(0); // 시작 불변
    expect(out[1]!.startMs).toBe(5000); // 다음 cue 불변
  });

  it('다음 cue 시작을 넘지 않게 clamp (겹침 방지)', () => {
    const cues = [
      cue(1, 0, 1000, 'a'.repeat(60)), // 60자 → 4초 필요
      cue(2, 1500, 2500, 'next'),
    ];
    const out = extendCueTimings(cues, 3000);
    expect(out[0]!.endMs).toBeLessThanOrEqual(1500 - 80);
    expect(out[0]!.endMs).toBeLessThan(out[1]!.startMs);
  });

  it('CPS 낮고 충분히 길면 변경 없음', () => {
    const cues = [cue(1, 0, 5000, 'short')];
    const out = extendCueTimings(cues, 5000);
    expect(out[0]!.endMs).toBe(5000);
  });

  it('너무 짧은 cue는 최소 지속(833ms)까지 연장', () => {
    // 0.3초짜리 짧은 자막 → CPS 낮아도 최소 833ms로
    const cues = [cue(1, 0, 300, 'hi')];
    const out = extendCueTimings(cues, 10000);
    expect(out[0]!.endMs).toBe(833);
  });

  it('최대 지속(7초)을 넘겨 연장하지 않음', () => {
    // 200자 → CPS상 13초 필요하지만 7초 상한
    const cues = [cue(1, 0, 1000, 'a'.repeat(200))];
    const out = extendCueTimings(cues, 60000);
    expect(out[0]!.endMs).toBe(7000);
  });

  it('마지막 cue는 영상 길이까지만 연장', () => {
    const cues = [cue(1, 0, 1000, 'a'.repeat(30))]; // 2초 필요
    const out = extendCueTimings(cues, 1500); // 영상 1.5초
    expect(out[0]!.endMs).toBe(1500);
  });
});

describe('fitTranslatedCues', () => {
  it('시간 연장 + 줄바꿈을 함께 적용', () => {
    const long = 'When you upload a video closed captions are generated automatically here';
    const out = fitTranslatedCues([cue(1, 0, 1000, long)], 60000);
    expect(out[0]!.text).toContain('\n'); // 줄바꿈됨
    expect(out[0]!.endMs).toBeGreaterThan(1000); // 시간 연장됨
  });
});
