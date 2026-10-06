import { env } from '@/lib/env';
import { FREE_MAX_RESOLUTION } from '@/types/caption-style';
import { FREE_MAX_LANGS_PER_JOB } from '@/services/translation/gating';
import { PRO_MAX_RESOLUTION } from '@/services/render/gating';

/**
 * 플랜별 사용 한도 — 요금제·이용약관·업로드 안내가 같은 값을 보이도록 한 곳에서 계산.
 * 실제 강제는 guards(업로드)·translation/render gating이 하고, 여기는 그 상수/env를 읽기만 한다.
 * 보관 기간은 services/jobs/cleanup.ts 정책(게스트 1시간 · 회원 30일)과 일치해야 한다.
 */
export interface PlanLimits {
  guest: { size: string; duration: string; retention: string };
  member: { size: string; duration: string; retention: string };
  free: { translateLangsPerJob: number; burnInResolution: number };
  pro: { burnInResolution: number };
}

export function getPlanLimits(): PlanLimits {
  return {
    guest: {
      size: formatBytes(env.GUEST_SIZE_LIMIT_BYTES),
      duration: formatDuration(env.GUEST_DURATION_LIMIT_SEC),
      retention: '1시간',
    },
    member: {
      size: formatBytes(env.MEMBER_SIZE_LIMIT_BYTES),
      duration: formatDuration(env.MEMBER_DURATION_LIMIT_SEC),
      retention: '30일',
    },
    free: { translateLangsPerJob: FREE_MAX_LANGS_PER_JOB, burnInResolution: FREE_MAX_RESOLUTION },
    pro: { burnInResolution: PRO_MAX_RESOLUTION },
  };
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)}GB`;
  }
  return `${Math.round(mb)}MB`;
}

export function formatDuration(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600}시간`;
  if (sec >= 60) return `${Math.round(sec / 60)}분`;
  return `${sec}초`;
}
