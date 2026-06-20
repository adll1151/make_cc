/**
 * 폰트 QA용 ASS 생성 — 실제 buildAss로 Pretendard/NotoSansKR 2종 출력.
 * WSL ffmpeg로 번인 후 프레임을 눈으로 확인해 tofu(□□□) 여부 검증.
 * 실행: npx tsx scripts/poc/gen-font-qa.mts
 */
import { writeFileSync } from 'node:fs';
import { buildAss } from '../../src/lib/ass';
import type { Cue } from '../../src/types/subtitle';
import type { CaptionStyle } from '../../src/types/caption-style';

const cues: Cue[] = [
  { index: 1, startMs: 0, endMs: 5000, text: '안녕하세요 자막 테스트입니다' },
  { index: 2, startMs: 0, endMs: 5000, text: '다람쥐 헌 쳇바퀴에 타고파 123' },
];

const base: CaptionStyle = {
  template: 'basic',
  fontFamily: 'Pretendard',
  fontSizePct: 6,
  color: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 3,
  position: 'middle',
  box: false,
  karaoke: false,
  karaokeColor: '#FFCC00',
};

const res = { playResX: 720, playResY: 1280 };

writeFileSync('scripts/poc/qa-pretendard.ass', buildAss(cues, { ...base, fontFamily: 'Pretendard' }, res));
writeFileSync('scripts/poc/qa-notosanskr.ass', buildAss(cues, { ...base, fontFamily: 'NotoSansKR' }, res));
console.log('wrote qa-pretendard.ass + qa-notosanskr.ass');
