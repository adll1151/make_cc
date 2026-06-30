import { CAPTION_TEMPLATES } from './caption-templates';
import type { CaptionSignals } from './caption-signals';

/**
 * 자막 스타일 어시(Tier 1) 추천 엔진 — 순수 함수.
 *
 * 신호 → 프리셋 추천 + 사람이 읽는 근거. 규칙은 단순·설명가능하게 유지.
 * 제안만 한다(자동 적용·잠금 X). 참조: caption-style-assist.plan.md §추천 규칙
 */

export interface CaptionSuggestion {
  /** CAPTION_TEMPLATES의 key */
  presetKey: string;
  presetLabel: string;
  /** 추천 근거(사용자 표시) */
  reasons: string[];
  /** 프리셋과 별개의 보조 안내(예: 화자 구분) */
  hint?: string;
  confidence: 'low' | 'medium' | 'high';
}

const labelOf = (key: string): string =>
  CAPTION_TEMPLATES.find((t) => t.key === key)?.label ?? key;

/** 말이 빠른 영상인가(고CPS cue 비율↑ 또는 중앙값↑). */
function isFastTalk(s: CaptionSignals): boolean {
  return s.highCpsRatio >= 0.3 || s.medianCps > 15;
}

/**
 * 휴리스틱 자막 스타일 추천. 신호 부족(자막 0개) 시 null.
 * 종횡비를 모르면(orientation=null) CPS 기반으로만 추천하고 confidence를 낮춘다.
 */
export function suggestCaptionStyle(signals: CaptionSignals): CaptionSuggestion | null {
  if (signals.cueCount === 0) return null;

  const reasons: string[] = [];
  const fast = isFastTalk(signals);
  let presetKey = 'basic';
  let confidence: CaptionSuggestion['confidence'] = signals.orientation ? 'medium' : 'low';

  if (signals.orientation === 'portrait') {
    if (fast) {
      presetKey = 'bold-yellow';
      reasons.push('세로형 영상이라 크고 굵은 자막이 잘 읽혀요');
      reasons.push('말이 빠른 편이에요 — 눈에 띄는 노란 자막을 추천해요');
      confidence = 'high';
    } else {
      presetKey = 'variety';
      reasons.push('쇼츠·릴스(세로형)엔 임팩트 있는 자막이 어울려요');
    }
  } else if (signals.orientation === 'landscape') {
    if (signals.totalDurationSec > 180 || signals.cueCount > 60) {
      presetKey = 'top-clean';
      reasons.push('길이가 긴 가로형 영상이라 시야를 덜 가리는 스타일이 좋아요');
    } else {
      presetKey = 'basic';
      reasons.push('가로형 영상엔 깔끔한 기본 자막이 가독성에 유리해요');
    }
  } else {
    // square 또는 종횡비 미상 → CPS만으로
    if (fast) {
      presetKey = 'bold-yellow';
      reasons.push('말이 빠른 편이라 크고 또렷한 자막을 추천해요');
    } else {
      presetKey = 'basic';
      reasons.push('무난한 기본 자막으로 시작하는 걸 추천해요');
    }
  }

  // 자막이 빠르고 많음 → 박스 배경 권장(픽셀 분석 없는 대용 지표)
  if (signals.highCpsRatio >= 0.4 && presetKey !== 'boxed') {
    reasons.push('자막이 빠르고 많아요 — 하단 박스 배경도 고려해보세요');
  }

  const hint =
    signals.speakerCount >= 2
      ? `화자가 ${signals.speakerCount}명이에요 — 화자 구분 표시를 켜보세요`
      : undefined;

  return { presetKey, presetLabel: labelOf(presetKey), reasons, hint, confidence };
}
