import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

/**
 * Supabase Storage 헬퍼.
 *
 * MVP 정책:
 *   - 영상 업로드: 클라이언트가 Signed Upload URL로 직접 PUT (Vercel 대역폭 절약)
 *     · 6MB 이하: 일반 PUT
 *     · 그 이상: Resumable Upload (TUS) — Supabase 가이드 참조
 *   - 자막 다운로드: 서버 프록시 (인증·접근권한 확인) 또는 짧은 만료 Signed URL
 *
 * 버킷은 모두 private. lifecycle은 워커가 직접 관리(자동 삭제 잡).
 */

const SIGN_UPLOAD_EXPIRES = 60 * 60; // 1 hour
const SIGN_DOWNLOAD_EXPIRES = 5 * 60; // 5 min

export function videosBucket() {
  return env.SUPABASE_BUCKET_VIDEOS;
}

export function subtitlesBucket() {
  return env.SUPABASE_BUCKET_SUBTITLES;
}

export function rendersBucket() {
  return env.SUPABASE_BUCKET_RENDERS;
}

// =========================================
// 영상 업로드
// =========================================

export interface SignedUploadResult {
  bucket: string;
  path: string;
  uploadUrl: string;
  token: string;
}

/**
 * 영상 업로드용 signed URL 발급 (admin only).
 * 클라이언트는 token으로 직접 Storage에 PUT.
 */
export async function createVideoUploadUrl(params: {
  jobId: string;
  fileName: string;
}): Promise<SignedUploadResult> {
  const admin = createAdminClient();
  const bucket = videosBucket();
  const path = videoStorageKey(params.jobId, params.fileName);

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: false,
  });
  if (error || !data) {
    throw new Error(`Storage signed upload URL 생성 실패: ${error?.message ?? 'unknown'}`);
  }
  return {
    bucket,
    path,
    uploadUrl: data.signedUrl,
    token: data.token,
  };
}

// =========================================
// 자막 업/다운/삭제
// =========================================

export async function putSubtitle(params: {
  jobId: string;
  body: string; // SRT text
}): Promise<{ bucket: string; path: string }> {
  const admin = createAdminClient();
  const bucket = subtitlesBucket();
  const path = subtitleStorageKey(params.jobId);

  // UTF-8 명시적 인코딩 — Supabase Storage SDK가 string을 받으면 charset이
  // 누락되거나 잘못 적용될 수 있음. Uint8Array로 변환해 항상 정확한 UTF-8 바이트 전송.
  const utf8Bytes = new TextEncoder().encode(params.body);

  const { error } = await admin.storage.from(bucket).upload(path, utf8Bytes, {
    contentType: 'application/x-subrip; charset=utf-8',
    upsert: true,
  });
  if (error) throw new Error(`자막 업로드 실패: ${error.message}`);

  return { bucket, path };
}

export async function getSubtitleText(jobId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(subtitlesBucket())
    .download(subtitleStorageKey(jobId));
  if (error || !data) throw new Error(`자막 다운로드 실패: ${error?.message ?? 'not found'}`);
  return data.text();
}

export async function presignVideoDownload(params: {
  storageKey: string;
  expiresIn?: number;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(videosBucket())
    .createSignedUrl(params.storageKey, params.expiresIn ?? 5 * 60);
  if (error || !data) throw new Error(`video signed URL 실패: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

export async function presignSubtitleDownload(params: {
  jobId: string;
  expiresIn?: number;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(subtitlesBucket())
    .createSignedUrl(subtitleStorageKey(params.jobId), params.expiresIn ?? SIGN_DOWNLOAD_EXPIRES, {
      download: `${params.jobId}.srt`,
    });
  if (error || !data) throw new Error(`signed URL 생성 실패: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

// =========================================
// 번인 렌더 출력 (renders 버킷)
// =========================================

export async function putRender(params: {
  renderId: string;
  body: Uint8Array | Blob;
}): Promise<{ bucket: string; path: string }> {
  const admin = createAdminClient();
  const bucket = rendersBucket();
  const path = renderStorageKey(params.renderId);
  const { error } = await admin.storage.from(bucket).upload(path, params.body, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) throw new Error(`렌더 업로드 실패: ${error.message}`);
  return { bucket, path };
}

export async function presignRenderDownload(params: {
  storageKey: string;
  downloadName?: string;
  expiresIn?: number;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(rendersBucket())
    .createSignedUrl(
      params.storageKey,
      params.expiresIn ?? SIGN_DOWNLOAD_EXPIRES,
      params.downloadName ? { download: params.downloadName } : undefined,
    );
  if (error || !data) throw new Error(`render signed URL 실패: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

export async function deleteRender(storageKey: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(rendersBucket()).remove([storageKey]);
  if (error) throw new Error(`렌더 삭제 실패: ${error.message}`);
}

// =========================================
// 단어 타이밍 JSON (subtitles 버킷, {jobId}.words.json)
// =========================================

/** whisperX 단어 타이밍을 JSON으로 저장 (cue+words 등 임의 payload). */
export async function putWordsJson(jobId: string, payload: unknown): Promise<void> {
  const admin = createAdminClient();
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const { error } = await admin.storage.from(subtitlesBucket()).upload(wordsStorageKey(jobId), bytes, {
    contentType: 'application/json; charset=utf-8',
    upsert: true,
  });
  if (error) throw new Error(`words.json 업로드 실패: ${error.message}`);
}

/** 단어 타이밍 JSON 로드. 없으면 null (whisperX 미적용 잡 → 평문 fallback). */
export async function getWordsJson<T = unknown>(jobId: string): Promise<T | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(subtitlesBucket()).download(wordsStorageKey(jobId));
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

export async function deleteVideo(params: {
  jobId: string;
  fileName: string;
}): Promise<void> {
  const admin = createAdminClient();
  const path = videoStorageKey(params.jobId, params.fileName);
  const { error } = await admin.storage.from(videosBucket()).remove([path]);
  if (error) throw new Error(`영상 삭제 실패: ${error.message}`);
}

export async function deleteSubtitle(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(subtitlesBucket())
    .remove([subtitleStorageKey(jobId)]);
  if (error) throw new Error(`자막 삭제 실패: ${error.message}`);
}

// =========================================
// Key 컨벤션 (Design §3.4)
// =========================================

/**
 * 버킷 내부 path. 버킷 이름은 prefix에 포함하지 않는다 (Supabase Storage는
 * bucket + path를 별도로 받는다).
 */
export function videoStorageKey(jobId: string, fileName: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = fileName.replace(/[^\w.\-]/g, '_');
  return `${yyyy}/${mm}/${jobId}/${safe}`;
}

export function subtitleStorageKey(jobId: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${jobId}/${jobId}.srt`;
}

export function wordsStorageKey(jobId: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${jobId}/${jobId}.words.json`;
}

/** renders 버킷 내부 path. renderId 기반(영상명 무관). */
export function renderStorageKey(renderId: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${renderId}/${renderId}.mp4`;
}

export const STORAGE_EXPIRES = {
  upload: SIGN_UPLOAD_EXPIRES,
  download: SIGN_DOWNLOAD_EXPIRES,
} as const;
