import { writeFileSync } from 'node:fs';
import { buildAss } from '../../src/lib/ass';

// 카라오케 단어 타이밍 포함 한국어 cue
const cues = [
  {
    index: 1,
    startMs: 0,
    endMs: 3000,
    text: '한국어 자막 번인 테스트 OK',
    words: [
      { text: '한국어', startMs: 0, endMs: 800 },
      { text: '자막', startMs: 800, endMs: 1400 },
      { text: '번인', startMs: 1400, endMs: 2000 },
      { text: '테스트', startMs: 2000, endMs: 2600 },
      { text: 'OK', startMs: 2600, endMs: 3000 },
    ],
  },
];

const style = {
  template: 'poc',
  fontFamily: 'Malgun Gothic', // PoC: Windows 한글 폰트
  fontSizePct: 9,
  color: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 3,
  position: 'bottom',
  box: false,
  karaoke: true,
  karaokeColor: '#FFCC00',
} as unknown as Parameters<typeof buildAss>[1];

// 9:16 720x1280 (module-3 출력 치수와 동일) — fontSizePct가 PlayResY 기준 계산됨
writeFileSync('scripts/poc/test-gen-916.ass', buildAss(cues, style, { playResX: 720, playResY: 1280 }));
writeFileSync('scripts/poc/test-gen.ass', buildAss(cues, style, { playResX: 640, playResY: 360 }));
console.log('test-gen.ass + test-gen-916.ass written');
