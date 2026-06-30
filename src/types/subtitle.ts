/**
 * 자막(CC) 도메인 타입.
 *
 * Cue: SRT의 한 자막 블록 (인덱스, 시작/종료 ms, 텍스트, 화자).
 * 타임코드는 ms 단위 정수 — 표시 시점에 timecode.ts로 변환.
 */
/** 단어 단위 타임스탬프 (whisperX). 카라오케 하이라이트·번인에 사용. */
export interface WordTiming {
  text: string;
  /** 단어 시작 (ms) */
  startMs: number;
  /** 단어 종료 (ms) */
  endMs: number;
}

export interface Cue {
  /** 1부터 시작하는 순번 (SRT 표준) */
  index: number;
  /**
   * 편집기 런타임 식별자 (옵션, 저장 안 됨). index는 추가/삭제 시 재번호가
   * 매겨지므로, 리스트 애니메이션(AnimatePresence)의 안정적 key로 사용.
   */
  uid?: string;
  /** 자막 시작 시각 (ms) */
  startMs: number;
  /** 자막 종료 시각 (ms). startMs < endMs */
  endMs: number;
  /** 자막 텍스트. 여러 줄은 '\n'으로 구분. HTML 태그 금지. */
  text: string;
  /**
   * 화자 식별자 (옵션). pyannote raw id 형태(`spk_0`, `spk_1`...) 권장.
   * SpeakerMap의 key와 매칭되어 SRT 빌드 시 `[표시명] ` prefix가 부착됨.
   */
  speakerId?: string;
  /**
   * 단어 단위 타임스탬프 (옵션, whisperX). 있으면 번인 카라오케 하이라이트 가능.
   * 없으면 cue 단위 평문으로 렌더 (카라오케 비활성).
   */
  words?: WordTiming[];
}

/**
 * 화자 ID → 표시 이름 매핑 (jobs.speaker_map JSONB의 타입).
 * 빈 객체는 1인 영상 또는 라벨 미사용 상태.
 *
 * 예: { spk_0: '화자 1', spk_1: '김지훈' }
 */
export type SpeakerMap = Record<string, string>;

/**
 * 편집기 표시용 화자 스타일 (런타임 derived, 저장 안 함).
 */
export interface SpeakerStyle {
  id: string;
  displayName: string;
  /** 0~5 — features/editor/lib/speaker-color.ts 매핑 인덱스 */
  colorIndex: number;
}

export interface Subtitle {
  jobId: string;
  language: 'ko';
  cues: Cue[];
  speakerMap: SpeakerMap;
  updatedAt: Date;
}
