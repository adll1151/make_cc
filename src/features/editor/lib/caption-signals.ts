import type { Cue, SpeakerMap } from '@/types/subtitle';

/**
 * 자막 스타일 어시(Tier 1) 신호 추출 — 순수 함수.
 *
 * 편집기가 이미 보유한 데이터(영상 종횡비·자막 cue·화자)만 사용한다.
 * 외부 API·GPU·프레임 분석 없음(그건 Tier 2/3).
 * 참조: docs/01-plan/features/caption-style-assist.plan.md
 */

export type VideoOrientation = 'portrait' | 'landscape' | 'square';

/** CPS = 공백 제외 글자수 / 지속(초). CueItem 배지와 동일 정의(단일 출처). */
export function computeCps(text: string, durationMs: number): number {
  const durSec = durationMs / 1000;
  if (durSec <= 0) return 0;
  const chars = text.replace(/\s/g, '').length;
  return chars / durSec;
}

/** 영상 가로/세로 비율로 방향 분류. 측정 불가면 null. */
export function orientationFromDimensions(
  width: number,
  height: number,
): VideoOrientation | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.15) return 'landscape';
  return 'square';
}

export interface CaptionSignals {
  /** 영상 방향. 측정 불가 시 null */
  orientation: VideoOrientation | null;
  cueCount: number;
  /** CPS 중앙값 (이상치에 강함) */
  medianCps: number;
  /** CPS>17(가독 한계 초과) cue 비율 0~1 */
  highCpsRatio: number;
  /** 구분된 화자 수 (0=미분리) */
  speakerCount: number;
  /** 평균 cue 글자수(개행=공백 환산) */
  avgChars: number;
  /** 총 자막 노출 길이(초) */
  totalDurationSec: number;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** cues(+화자맵·영상크기)에서 추천에 쓸 신호를 계산. */
export function extractCaptionSignals(
  cues: Cue[],
  speakerMap: SpeakerMap = {},
  videoDims?: { width: number; height: number } | null,
): CaptionSignals {
  const cpsList = cues
    .map((c) => computeCps(c.text, c.endMs - c.startMs))
    .filter((v) => v > 0);
  const high = cpsList.filter((v) => v > 17).length;
  const speakersFromCues = new Set(
    cues.map((c) => c.speakerId).filter((id): id is string => Boolean(id)),
  );
  const speakerCount = Math.max(speakersFromCues.size, Object.keys(speakerMap).length);
  const totalMs = cues.reduce((s, c) => s + Math.max(0, c.endMs - c.startMs), 0);
  const totalChars = cues.reduce((s, c) => s + c.text.replace(/\n/g, ' ').length, 0);

  return {
    orientation: videoDims
      ? orientationFromDimensions(videoDims.width, videoDims.height)
      : null,
    cueCount: cues.length,
    medianCps: median(cpsList),
    highCpsRatio: cpsList.length ? high / cpsList.length : 0,
    speakerCount,
    avgChars: cues.length ? totalChars / cues.length : 0,
    totalDurationSec: totalMs / 1000,
  };
}
