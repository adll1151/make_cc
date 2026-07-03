/**
 * 잡 도메인 타입.
 * DB 스키마(`supabase/migrations/20260613000001_init.sql`)와 1:1 매핑.
 * snake_case ↔ camelCase 변환은 services/jobs에서 처리.
 */

export type OwnerType = 'user' | 'guest';

/** Design §3.1 상태 머신 */
export type JobStatus =
  | 'pending'
  | 'uploading'
  | 'queued'
  | 'transcribing'
  | 'finished'
  | 'failed'
  | 'cancelled';

export const TERMINAL_STATUSES: readonly JobStatus[] = ['finished', 'failed', 'cancelled'] as const;

import type { SpeakerMap } from './subtitle';

export interface Job {
  id: string;
  ownerType: OwnerType;
  ownerId: string; // user.id(uuid 문자열) 또는 anonymousId 쿠키값
  userId: string | null;

  status: JobStatus;
  progressPercent: number; // 0~100
  queuePosition: number | null;

  videoOriginalName: string;
  videoSizeBytes: number;
  videoDurationSec: number;
  videoStorageKey: string;

  subtitleStorageKey: string | null;

  language: 'ko';
  errorCode: string | null;
  errorMessage: string | null;

  /** 화자 ID → 표시 이름 매핑. 빈 객체는 1인 영상 또는 라벨 미사용 */
  speakerMap: SpeakerMap;
  /** 워커가 이 잡에 화자 분리를 시도할지 여부 (기본 true) */
  diarizationEnabled: boolean;
  /** 리치 CC(비음성 사운드 이벤트 태깅) 활성 여부. false면 대사 자막만. */
  soundEventsEnabled: boolean;

  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  videoDeleteAt: Date | null;
}

export type JobEventType =
  | 'uploaded'
  | 'queued'
  | 'started'
  | 'progress'
  | 'finished'
  | 'failed'
  | 'cancelled'
  | 'notified';

export interface JobEvent {
  id: string;
  jobId: string;
  type: JobEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/** 잡 생성 시 받는 메타 (services/jobs.createJob 입력) */
export interface CreateJobInput {
  /** UUID. 미지정 시 DB가 생성. 영상 storage key를 사전 계산하려면 미리 지정 권장. */
  id?: string;
  ownerType: OwnerType;
  ownerId: string;
  userId: string | null;
  videoOriginalName: string;
  videoSizeBytes: number;
  videoDurationSec: number;
  videoStorageKey: string;
  /** 리치 CC 활성 여부. 미지정 시 DB 기본값(true). */
  soundEventsEnabled?: boolean;
}
