/**
 * 공유 링크 도메인 타입.
 * MVP: 회원이 생성 → 누구나 SRT 다운로드 가능 (영상 비공개).
 */
export interface ShareLink {
  id: string;
  jobId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null; // MVP는 영구 (null)
  revokedAt: Date | null;
  hits: number;
}
