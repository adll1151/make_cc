import { z } from 'zod';
import type { RenderStatus } from '@/types/caption-style';
import { isSupportedLang } from '@/services/translation/languages';

/**
 * POST /api/renders 요청 스키마 (번인 영상 내보내기).
 *
 * 클라이언트가 보낸 resolution/watermark는 **신뢰하지 않는다** — 서버가
 * is_pro 기준으로 게이팅(services/render/gating)에서 재결정한다.
 * 여기서는 형태(shape)와 입력 범위만 검증한다.
 */

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 형식의 색이어야 합니다.');

const captionStyleSchema = z.object({
  template: z.string().min(1).max(64),
  fontFamily: z.enum(['Pretendard', 'NotoSansKR']),
  fontSizePct: z.number().min(1).max(30),
  color: hexColor,
  outlineColor: hexColor,
  outlineWidth: z.number().min(0).max(20),
  position: z.enum(['bottom', 'middle', 'top']),
  box: z.boolean(),
  karaoke: z.boolean(),
  karaokeColor: hexColor,
});

export const createRenderSchema = z.object({
  jobId: z.string().min(1).max(64),
  aspect: z.enum(['original', '9:16', '1:1']),
  // 무료 사용자는 1080을 보내도 서버에서 720으로 강등됨 (에러 아님)
  resolution: z.union([z.literal(720), z.literal(1080)]),
  style: captionStyleSchema,
  // 번인 자막 언어. 'ko'=원본(기본), 그 외=완료된 번역 트랙 언어.
  subtitleLang: z
    .string()
    .optional()
    .default('ko')
    .refine((v) => v === 'ko' || isSupportedLang(v), '지원하지 않는 자막 언어입니다.'),
});

export type CreateRenderInput = z.infer<typeof createRenderSchema>;

export interface CreateRenderResponse {
  renderId: string;
}

export interface RenderStatusResponse {
  status: RenderStatus;
  /** 0~100 (done이면 100) */
  progressPercent: number;
  /** status==='done'일 때만 signed URL */
  downloadUrl: string | null;
  errorMessage: string | null;
}
