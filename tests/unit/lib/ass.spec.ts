import { describe, it, expect } from 'vitest';
import { buildAss, hexToAss, alignment, assTime, escapeAssText, assFontName } from '@/lib/ass';
import type { Cue } from '@/types/subtitle';
import type { CaptionStyle } from '@/types/caption-style';

const RES = { playResX: 1080, playResY: 1920 };

const baseStyle: CaptionStyle = {
  template: 'basic',
  fontFamily: 'Pretendard',
  fontSizePct: 5,
  color: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 3,
  position: 'bottom',
  box: false,
  karaoke: false,
  karaokeColor: '#FFCC00',
};

describe('hexToAss', () => {
  it('#RRGGBB → &HBBGGRR& (BGR 역순)', () => {
    expect(hexToAss('#FFCC00')).toBe('&H00CCFF&');
    expect(hexToAss('#000000')).toBe('&H000000&');
    expect(hexToAss('FFFFFF')).toBe('&HFFFFFF&');
  });
  it('잘못된 입력 → 흰색', () => {
    expect(hexToAss('nope')).toBe('&HFFFFFF&');
  });
});

describe('alignment', () => {
  it('position → numpad', () => {
    expect(alignment('bottom')).toBe(2);
    expect(alignment('middle')).toBe(5);
    expect(alignment('top')).toBe(8);
  });
});

describe('assTime', () => {
  it('ms → H:MM:SS.cs', () => {
    expect(assTime(0)).toBe('0:00:00.00');
    expect(assTime(1500)).toBe('0:00:01.50');
    expect(assTime(3_661_230)).toBe('1:01:01.23');
  });
  it('음수 → 0', () => {
    expect(assTime(-100)).toBe('0:00:00.00');
  });
});

describe('escapeAssText', () => {
  it('중괄호 차단 + 줄바꿈 변환', () => {
    expect(escapeAssText('a{b}c')).toBe('a(b)c');
    expect(escapeAssText('line1\nline2')).toBe('line1\\Nline2');
  });
});

describe('assFontName', () => {
  it('식별자 → fontconfig 내부 family명', () => {
    expect(assFontName('Pretendard')).toBe('Pretendard');
    // NotoSansKR 내부 family명은 공백 포함 — 불일치 시 tofu
    expect(assFontName('NotoSansKR')).toBe('Noto Sans KR');
  });
});

describe('buildAss', () => {
  const cues: Cue[] = [
    { index: 1, startMs: 0, endMs: 2000, text: '안녕하세요' },
    { index: 2, startMs: 2000, endMs: 4000, text: '반갑습니다' },
  ];

  it('기본 구조 — Script Info / Styles / Events', () => {
    const ass = buildAss(cues, baseStyle, RES);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Style: Default,Pretendard,96,'); // 1920*5% = 96
  });

  it('NotoSansKR → ASS Fontname은 내부 family명 "Noto Sans KR"로 정규화', () => {
    const ass = buildAss(cues, { ...baseStyle, fontFamily: 'NotoSansKR' }, RES);
    expect(ass).toContain('Style: Default,Noto Sans KR,96,');
    expect(ass).not.toContain('Style: Default,NotoSansKR,');
    expect(ass).toContain('[Events]');
    // Events Format은 반드시 Text로 끝나야 libass가 본문을 렌더 (PoC 검증)
    expect(ass).toContain('MarginR, MarginV, Effect, Text');
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,안녕하세요');
  });

  it('하단 정렬 + 외곽선(box=false → BorderStyle 1)', () => {
    const ass = buildAss(cues, baseStyle, RES);
    // BorderStyle 1, Alignment 2 (스타일 라인 끝부분)
    expect(/,1,3,0,2,/.test(ass)).toBe(true);
  });

  it('box=true → BorderStyle 3', () => {
    const ass = buildAss(cues, { ...baseStyle, box: true }, RES);
    expect(/,3,3,0,2,/.test(ass)).toBe(true);
  });

  it('카라오케 + words → \\k 태그', () => {
    const c: Cue[] = [
      {
        index: 1,
        startMs: 0,
        endMs: 1000,
        text: '안녕 하세요',
        words: [
          { text: '안녕', startMs: 0, endMs: 400 },
          { text: '하세요', startMs: 400, endMs: 1000 },
        ],
      },
    ];
    const ass = buildAss(c, { ...baseStyle, karaoke: true }, RES);
    expect(ass).toContain('{\\k40}안녕'); // 400ms → 40cs
    expect(ass).toContain('{\\k60}하세요'); // 600ms → 60cs
  });

  it('카라오케지만 words 없음 → 평문 fallback (\\k 없음)', () => {
    const ass = buildAss(cues, { ...baseStyle, karaoke: true }, RES);
    expect(ass).not.toContain('\\k');
    expect(ass).toContain(',,안녕하세요');
  });

  it('텍스트 이스케이프 — 중괄호 주입 차단', () => {
    const c: Cue[] = [{ index: 1, startMs: 0, endMs: 1000, text: '{\\fs99}해킹' }];
    const ass = buildAss(c, baseStyle, RES);
    expect(ass).not.toContain('{\\fs99}');
    expect(ass).toContain('(');
  });
});
