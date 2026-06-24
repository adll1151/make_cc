import type { Cue } from '@/types/subtitle';

/**
 * 번역 자막 가독성 후처리 (subtitle-translation).
 *
 * 한국어→영어 번역은 글자수가 1.5~2배로 늘어 ①화면에서 길어지고 ②읽을 시간이 부족하다.
 * - wrapText: 어절 단위로 줄바꿈(최대 2줄 균형, 길면 greedy). 화면 길이/줄 넘침 완화.
 * - extendCueTimings: CPS(읽기 속도)가 목표를 넘으면 뒤 간격만큼 종료 시각을 늘려 읽을 시간 확보.
 *
 * 모두 번역 트랙에만 적용(원본 ko는 불변). 순수 함수 — 단위 테스트 가능.
 */

// 업계 표준(Netflix Timed Text / BBC): CPL 42, 최대 2줄, 읽기속도 최적 12~15·최대 17 CPS,
// 최소 지속 5/6초(≈833ms), 최대 7초, 자막 간 갭 2프레임(≈80ms).
// 출처: partnerhelp.netflixstudios.com (Timed Text Style Guide), BBC Subtitle Guidelines.
export const MAX_LINE_CHARS = 42; // 라틴 문자 기준 한 줄 권장 길이
export const TARGET_CPS = 15; // 연장 목표 읽기 속도(공백 제외 글자수/초). 17은 허용 최대.
const MIN_DURATION_MS = 833; // 최소 표시 시간 (5/6초)
const MAX_DURATION_MS = 7000; // 최대 표시 시간
const MIN_GAP_KEEP_MS = 80; // 시간 연장 시 다음 자막과 유지할 최소 간격(≈2프레임)

/** 어절 단위 줄바꿈: ≤maxLen이면 1줄, ≤2*maxLen이면 가운데 어절에서 2줄 균형, 그 외 greedy. */
export function wrapText(text: string, maxLen = MAX_LINE_CHARS): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;

  // 2줄에 들어가면 가운데와 가장 가까운 공백에서 균형 분할
  if (t.length <= maxLen * 2) {
    const mid = Math.floor(t.length / 2);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === ' ') {
        const d = Math.abs(i - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    if (best > 0) return `${t.slice(0, best)}\n${t.slice(best + 1)}`;
  }

  // greedy 줄바꿈 (긴 텍스트 — 드묾)
  const words = t.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > maxLen) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

/**
 * 읽기 속도(CPS)가 목표를 넘거나 너무 짧은(<최소 지속) cue의 종료 시각을
 * 뒤 간격(또는 영상 끝)까지 연장. 시작·순서·개수 불변, 겹침/최대지속 방지.
 * (표준: 최소 833ms, 최대 7s, 목표 CPS 15)
 */
export function extendCueTimings(
  cues: Cue[],
  videoDurationMs: number,
  targetCps = TARGET_CPS,
): Cue[] {
  const out = cues.map((c) => ({ ...c }));
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!;
    const chars = c.text.replace(/\s/g, '').length;
    const curDur = c.endMs - c.startMs;
    if (curDur <= 0) continue;

    // 원하는 지속: max(현재, CPS 필요분, 최소지속) — 단 최대지속 이내
    const cpsNeedMs = chars > 0 ? Math.ceil((chars / targetCps) * 1000) : 0;
    let desiredDur = Math.max(curDur, cpsNeedMs, MIN_DURATION_MS);
    desiredDur = Math.min(desiredDur, MAX_DURATION_MS);
    if (desiredDur <= curDur) continue; // 연장 불필요

    const desiredEnd = c.startMs + desiredDur;
    const upper =
      i < out.length - 1
        ? out[i + 1]!.startMs - MIN_GAP_KEEP_MS
        : videoDurationMs > 0
          ? videoDurationMs
          : desiredEnd;
    const newEnd = Math.min(desiredEnd, Math.max(c.endMs, upper));
    if (newEnd > c.endMs) c.endMs = newEnd;
  }
  return out;
}

/** 번역 cue 가독성 후처리: 시간 연장 → 줄바꿈. */
export function fitTranslatedCues(cues: Cue[], videoDurationMs: number): Cue[] {
  return extendCueTimings(cues, videoDurationMs).map((c) => ({ ...c, text: wrapText(c.text) }));
}
