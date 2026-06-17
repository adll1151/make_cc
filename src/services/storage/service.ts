import {
  createVideoUploadUrl,
  putSubtitle,
  getSubtitleText,
  presignSubtitleDownload,
  deleteVideo,
  deleteSubtitle,
  videoStorageKey,
  videosBucket,
  subtitlesBucket,
  STORAGE_EXPIRES,
} from '@/lib/storage';
import type { Job } from '@/types/job';

// 영상 signed URL 발급 — lib/storage를 service 레이어로 노출 (route는 service 경유)
export { presignVideoDownload } from '@/lib/storage';

// 번인 렌더 출력 + 단어 타이밍 JSON (burnin-captions)
export {
  putRender,
  presignRenderDownload,
  deleteRender,
  renderStorageKey,
  putWordsJson,
  getWordsJson,
} from '@/lib/storage';

/**
 * Storage 서비스 — lib/storage를 도메인 시그니처로 래핑.
 *
 * lib/storage는 Supabase Storage 호출 자체에 집중하고,
 * 이 레이어는 Job 객체를 받아 storage_key 계산 + 호출을 일관화한다.
 * Route handler / worker는 이 서비스를 통해서만 접근.
 */

// =========================================
// 영상 업로드
// =========================================

export interface VideoUploadTicket {
  bucket: string;
  path: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
}

/**
 * 영상 업로드용 Signed Upload URL 발급.
 * 잡 생성 직후 호출되며, 클라이언트는 받은 URL로 직접 PUT.
 */
export async function requestVideoUpload(params: {
  jobId: string;
  fileName: string;
}): Promise<VideoUploadTicket> {
  const { uploadUrl, token, bucket, path } = await createVideoUploadUrl(params);
  return { bucket, path, uploadUrl, token, expiresIn: STORAGE_EXPIRES.upload };
}

/** 잡 생성 시 미리 정해놓는 storage key (createJob 호출자 활용) */
export function plannedVideoStorageKey(jobId: string, fileName: string): string {
  return videoStorageKey(jobId, fileName);
}

// =========================================
// 자막 (워커 + 편집 저장)
// =========================================

/**
 * 워커가 STT 완료 후 또는 사용자가 편집 후 호출.
 * 반환된 storage_key를 Job.subtitleStorageKey에 저장.
 */
export async function saveSubtitle(params: {
  jobId: string;
  srtText: string;
}): Promise<{ bucket: string; path: string }> {
  return putSubtitle({ jobId: params.jobId, body: params.srtText });
}

export async function loadSubtitleText(jobId: string): Promise<string> {
  return getSubtitleText(jobId);
}

export async function createSubtitleDownloadUrl(params: {
  jobId: string;
  expiresIn?: number;
}): Promise<string> {
  return presignSubtitleDownload(params);
}

// =========================================
// 자산 정리 (자동 삭제 잡)
// =========================================

/**
 * 잡의 영상·자막을 모두 삭제. 회원 만료(30일) / 게스트(다운로드 후) 시 호출.
 */
export async function deleteJobAssets(job: Job): Promise<void> {
  // 영상은 storage key에 파일명 포함 — Job에 저장된 키를 그대로 사용
  if (job.videoStorageKey) {
    try {
      await deleteVideo({
        jobId: job.id,
        fileName: job.videoStorageKey.split('/').pop() ?? job.videoOriginalName,
      });
    } catch (err) {
      // 이미 없어진 경우 등은 무시 가능 — 호출자 로그로 충분
      if (!(err instanceof Error) || !err.message.includes('not found')) throw err;
    }
  }
  if (job.subtitleStorageKey) {
    try {
      await deleteSubtitle(job.id);
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('not found')) throw err;
    }
  }
}

// =========================================
// 메타 노출 (route handler용)
// =========================================
export const STORAGE_BUCKETS = {
  videos: () => videosBucket(),
  subtitles: () => subtitlesBucket(),
} as const;
