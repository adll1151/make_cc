'use client';

import { create } from 'zustand';
import type { CaptionAspect, CaptionStyle } from '@/types/caption-style';
import { defaultCaptionStyle, getTemplate } from '../lib/caption-templates';

/**
 * 번인 내보내기 클라이언트 상태 (Design §5.2 useCaptionStyle).
 *
 * - style: 현재 자막 스타일 (프리셋 적용 또는 커스텀)
 * - aspect/resolution: 내보내기 옵션 (해상도는 서버가 is_pro로 재게이팅)
 * - renderId: 진행 중인 렌더 (ExportButton이 설정 → RenderProgress가 폴링)
 *
 * 커스텀 편집 시 template 키는 'custom'으로 바뀐다(어느 프리셋도 아님 표시).
 */
interface CaptionStyleStore {
  style: CaptionStyle;
  aspect: CaptionAspect;
  resolution: 720 | 1080;
  renderId: string | null;

  /** 프리셋 적용 */
  applyTemplate(key: string): void;
  /** 커스텀 부분 수정 (template → 'custom') */
  patchStyle(partial: Partial<CaptionStyle>): void;
  setAspect(aspect: CaptionAspect): void;
  setResolution(resolution: 720 | 1080): void;
  setRenderId(renderId: string | null): void;
}

export const useCaptionStyle = create<CaptionStyleStore>((set) => ({
  style: defaultCaptionStyle(),
  aspect: 'original',
  resolution: 720,
  renderId: null,

  applyTemplate(key) {
    set({ style: { ...getTemplate(key).style }, renderId: null });
  },

  patchStyle(partial) {
    set((s) => ({ style: { ...s.style, ...partial, template: 'custom' } }));
  },

  setAspect(aspect) {
    set({ aspect });
  },

  setResolution(resolution) {
    set({ resolution });
  },

  setRenderId(renderId) {
    set({ renderId });
  },
}));
