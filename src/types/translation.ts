/**
 * 자막 번역(subtitle-translation) 도메인 타입.
 *
 * Translation: 한 잡(job)의 한 대상 언어 번역 트랙. renders 도메인을 미러.
 * 상태머신: pending → translating → (done | failed)
 */

export type TranslationStatus = 'pending' | 'translating' | 'done' | 'failed';

/** 번역 트랙 1건 (도메인 표현). */
export interface Translation {
  id: string;
  jobId: string;
  userId: string | null;
  status: TranslationStatus;
  sourceLang: string;
  targetLang: string;
  engine: string;
  outputStorageKey: string | null;
  charCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  progressPercent: number;
  createdAt: Date;
  finishedAt: Date | null;
  outputDeleteAt: Date | null;
}

/** 사용자/스트림용 번역 뷰 (폴링·SSE·목록). */
export interface TranslationView {
  id: string;
  jobId: string;
  sourceLang: string;
  targetLang: string;
  status: TranslationStatus;
  /** 0~100 (done이면 100) */
  progressPercent: number;
  /** status==='done'일 때만 번역 SRT signed URL */
  downloadUrl: string | null;
  errorCode: string | null;
}

export interface TranslationOptions {
  /** 대상 언어 내부 코드 (en/ja/zh ...) */
  targetLang: string;
}
