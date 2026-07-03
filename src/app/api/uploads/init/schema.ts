import { z } from 'zod';

/**
 * POST /api/uploads/init 요청 스키마.
 *
 * - fileName: 원본 파일명 (storage key + UI 표시)
 * - fileSize: 바이트 (캡 검증 + Storage 멀티파트 분할 결정)
 * - durationSec: 영상 길이 (캡 검증 — 클라이언트의 <video> metadata에서 추출)
 * - mimeType: 화이트리스트 검증용
 */
export const uploadInitSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50 * 1024 ** 3), // < 50GB (방어적 상한)
  durationSec: z.number().int().positive().max(86400), // < 24h
  mimeType: z.string().min(1).max(100),
  /** 리치 CC(비음성 사운드 이벤트 태깅) 활성. 미지정 시 true(기본 ON). */
  richCc: z.boolean().optional().default(true),
});

export type UploadInitInput = z.infer<typeof uploadInitSchema>;

export interface UploadInitResponse {
  jobId: string;
  uploadUrl: string;
  token: string;
  bucket: string;
  path: string;
  expiresIn: number;
}
