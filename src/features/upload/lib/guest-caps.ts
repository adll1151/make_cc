/**
 * 클라이언트 표시·사전 검증용 캡 상수.
 *
 * ⚠️ 서버가 진실의 원천. 여기 값은 UX(인라인 안내)와 사전 검증에만 사용.
 * 서버 캡과 어긋나면 서버가 거부하므로 안전.
 *
 * 서버 정책: src/lib/env.ts + src/services/auth/guards.ts
 */

export const GUEST_CAPS = {
  durationSec: 300, // 5분
  sizeBytes: 200 * 1024 * 1024, // 200MB
} as const;

export const MEMBER_CAPS = {
  durationSec: 30 * 60, // 30분
  sizeBytes: 1024 * 1024 * 1024, // 1GB
} as const;

export const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm'] as const;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}
