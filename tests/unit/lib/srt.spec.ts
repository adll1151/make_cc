import { describe, it, expect } from 'vitest';
import { parseSrt, buildSrt, validateCues, normalizeCues } from '@/lib/srt';
import type { Cue } from '@/types/subtitle';

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:02,400
안녕하세요.

2
00:00:02,500 --> 00:00:05,800
오늘 강의를 시작하겠습니다.
두 줄도 가능합니다.

3
00:00:05,900 --> 00:00:09,000
마지막 cue.
`;

describe('parseSrt', () => {
  it('샘플 SRT를 cue 3개로 파싱', () => {
    const cues = parseSrt(SAMPLE_SRT);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({
      index: 1,
      startMs: 0,
      endMs: 2400,
      text: '안녕하세요.',
    });
    expect(cues[1]?.text).toBe('오늘 강의를 시작하겠습니다.\n두 줄도 가능합니다.');
    expect(cues[2]?.startMs).toBe(5900);
  });

  it('BOM이 있어도 파싱', () => {
    const cues = parseSrt('﻿' + SAMPLE_SRT);
    expect(cues).toHaveLength(3);
  });

  it('CRLF 줄바꿈도 파싱', () => {
    const cues = parseSrt(SAMPLE_SRT.replace(/\n/g, '\r\n'));
    expect(cues).toHaveLength(3);
  });

  it('빈 입력은 빈 배열', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('   \n\n  ')).toEqual([]);
  });

  it('인덱스가 누락된 cue는 재할당', () => {
    const noIndex = `00:00:00,000 --> 00:00:01,000
첫 자막

00:00:01,500 --> 00:00:02,500
두 번째`;
    const cues = parseSrt(noIndex);
    expect(cues[0]?.index).toBe(1);
    expect(cues[1]?.index).toBe(2);
  });

  it('reindex=false면 원본 인덱스 유지', () => {
    const odd = `5
00:00:00,000 --> 00:00:01,000
첫 자막

10
00:00:01,500 --> 00:00:02,500
두 번째`;
    const cues = parseSrt(odd, { reindex: false });
    expect(cues[0]?.index).toBe(5);
    expect(cues[1]?.index).toBe(10);
  });

  it('빈 cue (text 없음) 는 skip', () => {
    const withEmpty = `1
00:00:00,000 --> 00:00:01,000


2
00:00:01,500 --> 00:00:02,500
실제 자막`;
    const cues = parseSrt(withEmpty);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.text).toBe('실제 자막');
  });

  it('startMs >= endMs는 SyntaxError', () => {
    const bad = `1
00:00:02,000 --> 00:00:01,000
역전된 시간`;
    expect(() => parseSrt(bad)).toThrow(SyntaxError);
  });

  it('타임코드 라인이 없으면 SyntaxError', () => {
    const bad = `1
그냥 텍스트`;
    expect(() => parseSrt(bad)).toThrow(SyntaxError);
  });

  it('HTML 태그는 거부 (XSS 방어)', () => {
    const bad = `1
00:00:00,000 --> 00:00:01,000
<script>alert(1)</script>`;
    expect(() => parseSrt(bad)).toThrow(SyntaxError);
  });

  it('텍스트 길이 한도 초과는 SyntaxError', () => {
    const longText = 'a'.repeat(201);
    const bad = `1
00:00:00,000 --> 00:00:01,000
${longText}`;
    expect(() => parseSrt(bad, { maxTextLength: 200 })).toThrow(SyntaxError);
  });
});

describe('buildSrt', () => {
  const cues: Cue[] = [
    { index: 1, startMs: 0, endMs: 2400, text: '안녕하세요.' },
    { index: 2, startMs: 2500, endMs: 5800, text: '두 번째\n다중 줄' },
  ];

  it('cue를 SRT 문자열로 직렬화', () => {
    const out = buildSrt(cues);
    expect(out).toContain('00:00:00,000 --> 00:00:02,400');
    expect(out).toContain('안녕하세요.');
    expect(out).toContain('두 번째\n다중 줄');
  });

  it('reindex=true는 1부터 재할당', () => {
    const oddIndex: Cue[] = [
      { index: 100, startMs: 0, endMs: 1000, text: 'a' },
      { index: 200, startMs: 2000, endMs: 3000, text: 'b' },
    ];
    const out = buildSrt(oddIndex);
    expect(out.split('\n')[0]).toBe('1');
    expect(out).toMatch(/\n2\n/);
  });

  it('startMs >= endMs는 RangeError', () => {
    expect(() =>
      buildSrt([{ index: 1, startMs: 1000, endMs: 500, text: 'bad' }]),
    ).toThrow(RangeError);
  });

  it('trailingNewline=false면 끝의 빈 줄 제거', () => {
    const out = buildSrt(cues, { trailingNewline: false });
    expect(out.endsWith('\n')).toBe(false);
  });
});

describe('round-trip (parse → build → parse)', () => {
  it('샘플 SRT는 라운드트립 보존', () => {
    const parsed = parseSrt(SAMPLE_SRT);
    const rebuilt = buildSrt(parsed);
    const reparsed = parseSrt(rebuilt);
    expect(reparsed).toEqual(parsed);
  });
});

describe('validateCues', () => {
  it('겹침 없으면 빈 배열', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1000, text: 'a' },
      { index: 2, startMs: 1000, endMs: 2000, text: 'b' },
    ];
    expect(validateCues(cues)).toEqual([]);
  });

  it('이전 cue의 endMs > 다음 cue의 startMs는 겹침', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1500, text: 'a' },
      { index: 2, startMs: 1000, endMs: 2000, text: 'b' },
    ];
    const issues = validateCues(cues);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({ prevIndex: 1, nextIndex: 2, overlapMs: 500 });
  });

  it('startMs >= endMs는 invalid', () => {
    const cues: Cue[] = [{ index: 1, startMs: 1000, endMs: 500, text: 'bad' }];
    expect(validateCues(cues)).toHaveLength(1);
  });
});

describe('normalizeCues', () => {
  it('텍스트 양쪽 공백 제거 + 빈 cue 필터링 + 인덱스 재할당', () => {
    const cues: Cue[] = [
      { index: 5, startMs: 0, endMs: 1000, text: '  앞뒤 공백  ' },
      { index: 99, startMs: 1000, endMs: 2000, text: '' },
      { index: 3, startMs: 2000, endMs: 3000, text: '\t  유효한 cue\n' },
    ];
    const out = normalizeCues(cues);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ index: 1, startMs: 0, endMs: 1000, text: '앞뒤 공백' });
    expect(out[1]?.index).toBe(2);
  });
});
