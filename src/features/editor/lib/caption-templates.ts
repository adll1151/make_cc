import type { CaptionStyle } from '@/types/caption-style';

/**
 * 번인 자막 프리셋 (Design §5.1 TemplatePicker).
 *
 * 각 프리셋은 완성된 CaptionStyle. 선택 시 그대로 적용되고,
 * 이후 사용자가 커스텀하면 template 키는 'custom'으로 바뀐다(useCaptionStyle).
 * 색은 #RRGGBB(UI) — ASS 변환은 워커 lib/ass에서 수행.
 */

export interface CaptionTemplate {
  key: string;
  label: string;
  style: CaptionStyle;
}

export const CAPTION_TEMPLATES: readonly CaptionTemplate[] = [
  {
    key: 'basic',
    label: '기본',
    style: {
      template: 'basic',
      fontFamily: 'Pretendard',
      fontSizePct: 5.5,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 2.5,
      position: 'bottom',
      box: false,
      karaoke: false,
      karaokeColor: '#FFD400',
    },
  },
  {
    key: 'bold-yellow',
    label: '굵은 노랑',
    style: {
      template: 'bold-yellow',
      fontFamily: 'Pretendard',
      fontSizePct: 6.5,
      color: '#FFD400',
      outlineColor: '#000000',
      outlineWidth: 3.5,
      position: 'bottom',
      box: false,
      karaoke: false,
      karaokeColor: '#FF2D55',
    },
  },
  {
    key: 'boxed',
    label: '하단 박스',
    style: {
      template: 'boxed',
      fontFamily: 'Pretendard',
      fontSizePct: 5,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 0,
      position: 'bottom',
      box: true,
      karaoke: false,
      karaokeColor: '#FFD400',
    },
  },
  {
    key: 'top-clean',
    label: '상단',
    style: {
      template: 'top-clean',
      fontFamily: 'NotoSansKR',
      fontSizePct: 5,
      color: '#FFFFFF',
      outlineColor: '#1A1A1A',
      outlineWidth: 2,
      position: 'top',
      box: false,
      karaoke: false,
      karaokeColor: '#FFD400',
    },
  },
  {
    key: 'variety',
    label: '예능',
    style: {
      template: 'variety',
      fontFamily: 'Pretendard',
      fontSizePct: 7,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3.5,
      position: 'bottom',
      box: false,
      karaoke: true,
      karaokeColor: '#FF2D55',
    },
  },
] as const;

export const DEFAULT_TEMPLATE_KEY = 'basic';

export function getTemplate(key: string): CaptionTemplate {
  return CAPTION_TEMPLATES.find((t) => t.key === key) ?? CAPTION_TEMPLATES[0]!;
}

/** 기본 프리셋의 스타일 복사본 (store 초기값). */
export function defaultCaptionStyle(): CaptionStyle {
  return { ...getTemplate(DEFAULT_TEMPLATE_KEY).style };
}
