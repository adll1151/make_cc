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

export const SAMPLE_CUES: Cue[] = DEMO_CUES.map((c, i) => {
  const parts = c.time.split('-->');
  return {
    index: i + 1,
    startMs: srtTimeToMs(parts[0] ?? '0'),
    endMs: srtTimeToMs(parts[1] ?? '0'),
    text: c.text,
  };
});
