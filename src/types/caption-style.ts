/**
 * 번인 자막 스타일 + 렌더 도메인 타입.
 * 참조: docs/02-design/features/burnin-captions.design.md §3.1
 */

export type CaptionPosition = 'bottom' | 'middle' | 'top';
export type CaptionAspect = 'original' | '9:16' | '1:1';
export type RenderStatus = 'pending' | 'rendering' | 'done' | 'failed';

/** 번들 폰트(OFL) 식별자 — 워커 fontconfig 등록명과 일치해야 함. */
export type CaptionFont = 'Pretendard' | 'NotoSansKR';

export interface CaptionStyle {
  /** 프리셋 키 (features/editor/lib/caption-templates) */
  template: string;
  fontFamily: CaptionFont;
  /** 영상 높이 대비 % (반응형). 예: 5 → 1080p에서 54px */
  fontSizePct: number;
  /** 주 색 #RRGGBB */
  color: string;
  /** 외곽선 색 #RRGGBB */
  outlineColor: string;
  /** 외곽선 두께 (px) */
  outlineWidth: number;
  position: CaptionPosition;
  /** 하단 반투명 박스 (BorderStyle=3) */
  box: boolean;
  /** 단어 하이라이트(카라오케). words 없으면 무시 */
  karaoke: boolean;
  /** 하이라이트 색 #RRGGBB */
  karaokeColor: string;
}

export interface RenderOptions {
  aspect: CaptionAspect;
  /** Pro만 1080 */
  resolution: 720 | 1080;
  style: CaptionStyle;
  /** 번인할 자막 언어 내부 코드. 'ko'=원본(기본), 그 외=번역 트랙. */
  subtitleLang?: string;
}

export interface Render {
  id: string;
  jobId: string;
  userId: string | null;
  status: RenderStatus;
  aspect: CaptionAspect;
  resolution: number;
  /** 무료=true(워터마크) */
  watermark: boolean;
  style: CaptionStyle;
  /** 번인된 자막 언어 내부 코드 ('ko'=원본) */
  subtitleLang: string;
  /** 번인 렌더 진행률 0~100 (워커가 ffmpeg 진행률로 갱신) */
  progressPercent: number;
  outputStorageKey: string | null;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  outputDeleteAt: Date | null;
}

/** 무료 티어 최대 해상도 (게이팅 — services/render 한 곳에서만 사용). */
export const FREE_MAX_RESOLUTION = 720 as const;
