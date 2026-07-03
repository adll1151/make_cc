import { DEMO_CUES } from '@/data/demo-cues';
import type { Cue } from '@/types/subtitle';

/**
 * 가입 전 "샘플로 편집기 체험" 모드용 큐.
 * /demo의 DEMO_CUES(공개 예시 자막)를 편집기 Cue로 변환한다.
 * 실제 잡·워커·로그인 없이 편집기를 그대로 체험하기 위한 것.
 */
function srtTimeToMs(t: string): number {
  const [hms = '0', ms = '0'] = t.trim().split(',');
  const [h = '0', m = '0', s = '0'] = hms.split(':');
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms);
}

export const SAMPLE_JOB_ID = 'sample' as const;
export const SAMPLE_VIDEO_SRC = '/samples/demo.mp4';
export const SAMPLE_SRT_HREF = '/samples/make_cc-korean-sample.srt';

const SAMPLE_SPEECH_CUES: Cue[] = DEMO_CUES.map((c) => {
  const parts = c.time.split('-->');
  return {
    index: 0,
    startMs: srtTimeToMs(parts[0] ?? '0'),
    endMs: srtTimeToMs(parts[1] ?? '0'),
    text: c.text,
  };
});

/**
 * 리치 CC 데모용 사운드 큐(비음성). 가입 전 편집기 체험에서 CC 사운드 태깅을
 * 보여주기 위한 예시(♪음악♪·[박수]). 실제 워커는 오디오 이벤트로 자동 생성.
 */
const SAMPLE_SOUND_CUES: Cue[] = [
  { index: 0, startMs: 0, endMs: 2200, text: '♪ 음악 ♪', kind: 'sound', soundTag: 'Music' },
];

export const SAMPLE_CUES: Cue[] = [...SAMPLE_SPEECH_CUES, ...SAMPLE_SOUND_CUES]
  .sort((a, b) => a.startMs - b.startMs || (a.kind === 'sound' ? 1 : 0) - (b.kind === 'sound' ? 1 : 0))
  .map((c, i) => ({ ...c, index: i + 1 }));
