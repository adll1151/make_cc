import { env } from '@/lib/env';
import { AppError } from '@/lib/api';
import type { OwnerContext } from '@/types/session';
import { getGuestDailyUsage } from '@/services/auth/quotas';

/**
 * 업로드 가능 여부 사전 검증 (Plan §3.1 FR-02/FR-03, Design §4.2 `/api/uploads/init`).
 *
 * 검증 항목:
 *   1. 파일 크기 캡 (owner.kind별)
 *   2. 영상 길이 캡 (owner.kind별)
 *   3. 게스트 글로벌 일일 캡 (잡 수 + 총 길이)
 *
 * 실패 시 AppError를 throw하며, 호출자(API Route)가 표준 응답으로 변환한다.
 *
 * 멤버 1인당 일일 캡은 MVP 미적용 — 회원 회수 가속 우선.
 */

export interface UploadIntent {
  fileSizeBytes: number;
  durationSec: number;
  mimeType: string;
}

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
]);

export async function assertCanUpload(
  owner: OwnerContext,
  intent: UploadIntent,
): Promise<void> {
  // 1. MIME 화이트리스트
  if (!ALLOWED_MIME.has(intent.mimeType)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      `지원하지 않는 영상 형식입니다 (${intent.mimeType}). MP4·MOV·MKV·WebM만 처리할 수 있습니다.`,
      { mimeType: intent.mimeType, allowed: Array.from(ALLOWED_MIME) },
    );
  }

  // 2. 양수 검증 (방어적)
  if (intent.fileSizeBytes <= 0 || intent.durationSec <= 0) {
    throw new AppError('INVALID_INPUT', '파일 크기 또는 영상 길이가 올바르지 않습니다.', {
      fileSizeBytes: intent.fileSizeBytes,
      durationSec: intent.durationSec,
    });
  }

  // 3. 캡 정책 선택
  const policy = pickPolicy(owner);

  // 4. 개별 캡 검증
  if (intent.fileSizeBytes > policy.sizeLimit) {
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      policy.kind === 'guest'
        ? `게스트는 ${formatMB(policy.sizeLimit)} 이하 영상만 처리 가능합니다. 회원가입 시 ${formatMB(env.MEMBER_SIZE_LIMIT_BYTES)}까지 가능합니다.`
        : `영상 크기가 너무 큽니다 (최대 ${formatMB(policy.sizeLimit)}).`,
      {
        actual: intent.fileSizeBytes,
        limit: policy.sizeLimit,
        upgradeUrl: policy.kind === 'guest' ? '/login' : undefined,
      },
    );
  }
  if (intent.durationSec > policy.durationLimit) {
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      policy.kind === 'guest'
        ? `게스트는 ${formatMinutes(policy.durationLimit)} 이내 영상만 처리 가능합니다. 회원가입 시 ${formatMinutes(env.MEMBER_DURATION_LIMIT_SEC)}까지 가능합니다.`
        : `영상이 너무 깁니다 (최대 ${formatMinutes(policy.durationLimit)}).`,
      {
        actual: intent.durationSec,
        limit: policy.durationLimit,
        upgradeUrl: policy.kind === 'guest' ? '/login' : undefined,
      },
    );
  }

  // 5. 게스트 글로벌 일일 캡
  if (owner.kind === 'guest') {
    const usage = await getGuestDailyUsage();
    if (usage.totalJobs >= env.GUEST_DAILY_GLOBAL_CAP_JOBS) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        '오늘의 게스트 처리량을 모두 사용했습니다. 회원가입하시면 바로 사용 가능합니다.',
        {
          reason: 'guest_daily_jobs',
          resetAtUtc: nextUtcMidnight(),
          upgradeUrl: '/login',
        },
      );
    }
    if (
      usage.totalDurationSec + intent.durationSec >
      env.GUEST_DAILY_GLOBAL_CAP_DURATION
    ) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        '오늘의 게스트 누적 영상 길이를 초과했습니다. 회원가입하시면 바로 사용 가능합니다.',
        {
          reason: 'guest_daily_duration',
          resetAtUtc: nextUtcMidnight(),
          upgradeUrl: '/login',
        },
      );
    }
  }
}

// =========================================
// 내부 헬퍼 — 정책 선택, 포맷
// =========================================

interface Policy {
  kind: 'guest' | 'user';
  sizeLimit: number;
  durationLimit: number;
}

function pickPolicy(owner: OwnerContext): Policy {
  if (owner.kind === 'user') {
    return {
      kind: 'user',
      sizeLimit: env.MEMBER_SIZE_LIMIT_BYTES,
      durationLimit: env.MEMBER_DURATION_LIMIT_SEC,
    };
  }
  return {
    kind: 'guest',
    sizeLimit: env.GUEST_SIZE_LIMIT_BYTES,
    durationLimit: env.GUEST_DURATION_LIMIT_SEC,
  };
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${Math.round(mb)}MB`;
}

function formatMinutes(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m}분`;
}

function nextUtcMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
