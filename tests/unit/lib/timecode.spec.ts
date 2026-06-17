import { describe, it, expect } from 'vitest';
import { formatTimecode, parseTimecode } from '@/lib/timecode';

describe('formatTimecode', () => {
  it('0ms → 00:00:00,000 (SRT)', () => {
    expect(formatTimecode(0)).toBe('00:00:00,000');
    expect(formatTimecode(0, 'srt')).toBe('00:00:00,000');
  });

  it('0ms → 00:00:00.000 (VTT)', () => {
    expect(formatTimecode(0, 'vtt')).toBe('00:00:00.000');
  });

  it('1234ms → 00:00:01,234', () => {
    expect(formatTimecode(1234)).toBe('00:00:01,234');
  });

  it('3600ms → 00:00:03,600', () => {
    expect(formatTimecode(3600)).toBe('00:00:03,600');
  });

  it('1시간+1분+1초+1ms → 01:01:01,001', () => {
    const ms = 3600_000 + 60_000 + 1000 + 1;
    expect(formatTimecode(ms)).toBe('01:01:01,001');
  });

  it('100시간도 자리수 확장', () => {
    const ms = 100 * 3600_000;
    expect(formatTimecode(ms)).toBe('100:00:00,000');
  });

  it('소수점 ms는 반올림', () => {
    expect(formatTimecode(1500.4)).toBe('00:00:01,500');
    expect(formatTimecode(1500.6)).toBe('00:00:01,501');
  });

  it('음수는 RangeError', () => {
    expect(() => formatTimecode(-1)).toThrow(RangeError);
  });

  it('NaN/Infinity는 RangeError', () => {
    expect(() => formatTimecode(NaN)).toThrow(RangeError);
    expect(() => formatTimecode(Infinity)).toThrow(RangeError);
  });
});

describe('parseTimecode', () => {
  it('SRT 정규형식', () => {
    expect(parseTimecode('00:00:00,000')).toBe(0);
    expect(parseTimecode('00:00:01,234')).toBe(1234);
    expect(parseTimecode('01:01:01,001')).toBe(3600_000 + 60_000 + 1000 + 1);
  });

  it('VTT 마침표 구분자', () => {
    expect(parseTimecode('00:00:01.234', 'vtt')).toBe(1234);
  });

  it('VTT 단축 형식 MM:SS.mmm', () => {
    expect(parseTimecode('01:30.500', 'vtt')).toBe(60_000 + 30_000 + 500);
  });

  it('format 미지정 시 SRT 우선 시도, 실패하면 VTT', () => {
    expect(parseTimecode('00:00:01,234')).toBe(1234);
    expect(parseTimecode('00:00:01.234')).toBe(1234);
  });

  it('잘못된 형식은 SyntaxError', () => {
    expect(() => parseTimecode('00:00:01')).toThrow(SyntaxError);
    expect(() => parseTimecode('1:2:3,4')).toThrow(SyntaxError);
    expect(() => parseTimecode('not a timecode')).toThrow(SyntaxError);
  });

  it('60초/60분은 허용 안 함 (정규식 [0-5]\\d)', () => {
    expect(() => parseTimecode('00:60:00,000')).toThrow(SyntaxError);
    expect(() => parseTimecode('00:00:60,000')).toThrow(SyntaxError);
  });

  it('앞뒤 공백은 trim', () => {
    expect(parseTimecode('  00:00:01,234  ')).toBe(1234);
  });
});

describe('round-trip (format ↔ parse)', () => {
  it.each([0, 1, 999, 1000, 1234, 60_000, 3600_000, 12_345_678])(
    'SRT 라운드트립: %ims → string → ms',
    (ms) => {
      expect(parseTimecode(formatTimecode(ms))).toBe(ms);
    },
  );
});
