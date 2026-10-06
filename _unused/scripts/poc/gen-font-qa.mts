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
  // 일부러 프레임 폭을 넘는 긴 한 줄 — WrapStyle 0이면 자동 줄바꿈되어야 함(잘림 X)
  {
    index: 1,
    startMs: 0,
    endMs: 5000,
    text: '안녕하세요 이 문장은 한 줄에 다 담기에는 충분히 길어서 자동 줄바꿈이 되는지 확인하기 위한 테스트 자막입니다',
  },
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
