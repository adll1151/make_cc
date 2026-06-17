import type { Cue, SpeakerMap } from '@/types/subtitle';

/**
 * 화자 라벨 적용·추출 — pure 함수, 외부 의존성 없음.
 *
 * SRT 텍스트 표현:
 *   `[<displayName>] <text>` 형식 (대괄호 + 공백 1칸)
 *
 * 정책:
 *   - 1인 영상 / 빈 SpeakerMap → 라벨 미부착 (cue.text 그대로)
 *   - cue.speakerId가 SpeakerMap에 없으면 → 라벨 미부착 (graceful)
 *   - 다인 + 매칭 성공 → prefix 부착
 *   - 다인 임계: cue 80% 이상 단일 화자 → 1인 판정
 *
 * 회귀 방어:
 *   - 이미 prefix가 있는 cue.text에 또 prefix를 붙이지 않음 (정규식으로 사전 검사)
 *   - stripLabels는 prefix가 없는 라인을 그대로 통과 (기존 SRT 안전)
 */

/**
 * 라벨 매칭 정규식.
 * - `[` 시작 + 닫는 `]` + 공백 1칸 이상 + 본문
 * - displayName은 줄바꿈/`]`/`[` 금지
 */
export const LABEL_REGEX = /^\[([^\[\]\n]{1,30})\]\s+(.+)$/s;

/** 다인 판정 임계 — cue 80% **초과** 단일 화자면 1인으로 판정 */
export const MULTI_SPEAKER_THRESHOLD = 0.8;

/** 표시 이름 최대 길이 (Zod 검증과 동일) */
export const MAX_DISPLAY_NAME_LENGTH = 30;

/** SpeakerMap key 최대 개수 (DoS 방어) */
export const MAX_SPEAKER_MAP_KEYS = 20;

/**
 * cues 80% 초과 단일 화자인지 검사.
 *
 * - speaker 라벨이 있는 cue가 전체의 50% 미만이면 라벨 신뢰도 낮음 → 1인 판정
 * - 라벨 있는 cue 중 가장 많은 화자의 점유율이 80%를 **초과**하면 1인
 */
export function isMultiSpeaker(cues: ReadonlyArray<Cue>): boolean {
  if (cues.length === 0) return false;
  const labeled = cues.filter((c) => typeof c.speakerId === 'string' && c.speakerId.length > 0);

  // 라벨이 절반 미만이면 신뢰도 부족 → 1인 처리 (라벨 없는 평문)
  if (labeled.length < cues.length * 0.5) return false;

  const counts = new Map<string, number>();
  for (const c of labeled) {
    counts.set(c.speakerId!, (counts.get(c.speakerId!) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const dominantRatio = maxCount / labeled.length;
  // 80% **초과**시에만 1인 — 정확히 80%는 다인 처리 (안전 마진)
  return dominantRatio <= MULTI_SPEAKER_THRESHOLD;
}

/**
 * 라벨 부착.
 *
 * - speakerMap이 비었거나 cue.speakerId가 없거나 매칭 안 되면 prefix 부착 안 함
 * - 이미 cue.text가 `[xxx] ` 형식이면 prefix 부착 안 함 (이중 라벨 방지)
 */
export function applyLabels(cues: ReadonlyArray<Cue>, speakerMap: SpeakerMap): Cue[] {
  if (!speakerMap || Object.keys(speakerMap).length === 0) {
    return cues.map((c) => ({ ...c }));
  }

  return cues.map((cue) => {
    const speakerId = cue.speakerId;
    if (!speakerId) return { ...cue };
    const displayName = speakerMap[speakerId];
    if (!displayName) return { ...cue };
    // 이미 라벨 있으면 skip (단, 다른 라벨이어도 그대로 — 사용자 편집 존중)
    if (LABEL_REGEX.test(cue.text)) return { ...cue };
    return { ...cue, text: `[${displayName}] ${cue.text}` };
  });
}

/**
 * 라벨 추출 + cue.text 정리 + speakerId 복원.
 *
 * - speakerMap이 있으면 라벨 → speakerId 역매핑 시도
 * - 없으면 raw 라벨 텍스트를 speakerId로 사용 (임시)
 * - prefix 없는 라인은 그대로 통과 (회귀 0)
 */
export function stripLabels(
  cues: ReadonlyArray<Cue>,
  speakerMap?: SpeakerMap,
): Cue[] {
  const nameToId = new Map<string, string>();
  if (speakerMap) {
    for (const [id, name] of Object.entries(speakerMap)) {
      nameToId.set(name, id);
    }
  }

  return cues.map((cue) => {
    const m = LABEL_REGEX.exec(cue.text);
    if (!m) return { ...cue };
    const rawName = m[1]!;
    const pureText = m[2]!;
    const resolvedId = nameToId.get(rawName) ?? cue.speakerId ?? rawName;
    return { ...cue, text: pureText, speakerId: resolvedId };
  });
}

/**
 * cues에서 등장하는 모든 화자 ID를 순서대로 반환 (중복 제거).
 * SpeakerMap 초기 생성에 사용 — `spk_0` → `화자 1`, `spk_1` → `화자 2` 등.
 */
export function extractSpeakerIds(cues: ReadonlyArray<Cue>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const c of cues) {
    if (c.speakerId && !seen.has(c.speakerId)) {
      seen.add(c.speakerId);
      order.push(c.speakerId);
    }
  }
  return order;
}

/**
 * 자동 SpeakerMap 생성 — `spk_0` → `화자 1`, `spk_1` → `화자 2` ...
 * 다인 판정이 false면 빈 객체 반환 (1인 처리).
 */
export function buildAutoSpeakerMap(cues: ReadonlyArray<Cue>): SpeakerMap {
  if (!isMultiSpeaker(cues)) return {};
  const ids = extractSpeakerIds(cues);
  const map: SpeakerMap = {};
  ids.forEach((id, idx) => {
    map[id] = `화자 ${idx + 1}`;
  });
  return map;
}

/**
 * 화자별 발화 시간(ms) 집계 — 편집기 SpeakerMapEditor에서 통계 표시.
 */
export function speakerDurations(cues: ReadonlyArray<Cue>): Map<string, number> {
  const durations = new Map<string, number>();
  for (const c of cues) {
    if (!c.speakerId) continue;
    const dur = Math.max(0, c.endMs - c.startMs);
    durations.set(c.speakerId, (durations.get(c.speakerId) ?? 0) + dur);
  }
  return durations;
}

/**
 * SpeakerMap 검증 — Zod 사용 안 하고 도메인에서 직접 (서버·클라이언트 양쪽 사용).
 *
 * 위반 사항을 문자열 배열로 반환 (빈 배열이면 valid).
 */
export function validateSpeakerMap(map: SpeakerMap): string[] {
  const errors: string[] = [];
  const keys = Object.keys(map);
  if (keys.length > MAX_SPEAKER_MAP_KEYS) {
    errors.push(`화자 수는 최대 ${MAX_SPEAKER_MAP_KEYS}명까지 가능합니다.`);
  }
  for (const [id, name] of Object.entries(map)) {
    if (typeof name !== 'string') {
      errors.push(`화자 "${id}"의 이름이 문자열이 아닙니다.`);
      continue;
    }
    if (name.length === 0) {
      errors.push(`화자 "${id}"의 이름이 비어있습니다.`);
    }
    if (name.length > MAX_DISPLAY_NAME_LENGTH) {
      errors.push(`화자 "${id}"의 이름이 ${MAX_DISPLAY_NAME_LENGTH}자를 초과합니다.`);
    }
    if (/<[a-z]/i.test(name)) {
      errors.push(`화자 "${id}"의 이름에 HTML 태그는 허용되지 않습니다.`);
    }
    if (/[\[\]\n]/.test(name)) {
      errors.push(`화자 "${id}"의 이름에 '[', ']', 줄바꿈은 허용되지 않습니다.`);
    }
  }
  return errors;
}
