import { z } from 'zod';
import { isSupportedLang } from '@/services/translation';
import type { TranslationView } from '@/types/translation';

/**
 * POST /api/translations 요청 스키마 (자막 번역 생성).
 *
 * 게이팅(무료 잡당 1언어 / Pro 무제한)은 services/translation에서 강제.
 * 여기서는 형태 + 지원 언어 화이트리스트만 검증.
 */
export const createTranslationSchema = z.object({
  jobId: z.string().min(1).max(64),
  targetLang: z.string().refine(isSupportedLang, '지원하지 않는 언어입니다.'),
});

export type CreateTranslationInput = z.infer<typeof createTranslationSchema>;

export interface CreateTranslationResponse {
  translationId: string;
}

/** GET /api/translations/[id] 응답 — TranslationView 그대로 노출. */
export type TranslationStatusResponse = TranslationView;
