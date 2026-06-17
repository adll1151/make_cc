import { describe, it, expect } from 'vitest';
import {
  applyLabels,
  stripLabels,
  isMultiSpeaker,
  extractSpeakerIds,
  buildAutoSpeakerMap,
  speakerDurations,
  validateSpeakerMap,
  LABEL_REGEX,
  MAX_SPEAKER_MAP_KEYS,
} from '@/lib/srt-labeling';
import type { Cue, SpeakerMap } from '@/types/subtitle';

const c = (index: number, startMs: number, endMs: number, text: string, speakerId?: string): Cue => ({
  index,
  startMs,
  endMs,
  text,
  speakerId,
});

describe('LABEL_REGEX', () => {
  it('정상 라벨 매칭', () => {
    const m = LABEL_REGEX.exec('[화자 1] 안녕하세요');
    expect(m?.[1]).toBe('화자 1');
    expect(m?.[2]).toBe('안녕하세요');
  });

  it('이름에 공백 OK', () => {
    const m = LABEL_REGEX.exec('[김 지훈] 본문');
    expect(m?.[1]).toBe('김 지훈');
  });

  it('영문/숫자 이름 OK', () => {
    const m = LABEL_REGEX.exec('[Speaker A1] hello');
    expect(m?.[1]).toBe('Speaker A1');
  });

  it('prefix 없는 라인 미매칭', () => {
    expect(LABEL_REGEX.exec('그냥 텍스트')).toBeNull();
  });

  it('이름에 줄바꿈 금지', () => {
    expect(LABEL_REGEX.exec('[화\n자] x')).toBeNull();
  });

  it('이름에 닫는 대괄호 금지', () => {
    expect(LABEL_REGEX.exec('[화]자] x')).toBeNull();
  });
});

describe('isMultiSpeaker', () => {
  it('빈 cues는 false', () => {
    expect(isMultiSpeaker([])).toBe(false);
  });

  it('라벨 없는 cues는 false (1인 처리)', () => {
    const cues = [c(1, 0, 1000, '안녕'), c(2, 1000, 2000, '반가워')];
    expect(isMultiSpeaker(cues)).toBe(false);
  });

  it('라벨 절반 미만이면 신뢰도 부족 → false', () => {
    const cues = [
      c(1, 0, 1000, 'a', 'spk_0'),
      c(2, 1000, 2000, 'b'),
      c(3, 2000, 3000, 'c'),
      c(4, 3000, 4000, 'd'),
    ];
    expect(isMultiSpeaker(cues)).toBe(false);
  });

  it('단일 화자 100% → false (1인)', () => {
    const cues = [c(1, 0, 1, 'a', 'spk_0'), c(2, 1, 2, 'b', 'spk_0'), c(3, 2, 3, 'c', 'spk_0')];
    expect(isMultiSpeaker(cues)).toBe(false);
  });

  it('80% 정확히 단일 → 다인 (>= 안 함)', () => {
    // 10개 중 8개가 spk_0 → 정확히 80% → 다인
    const cues = Array.from({ length: 10 }, (_, i) =>
      c(i + 1, i * 1000, (i + 1) * 1000, 't', i < 8 ? 'spk_0' : 'spk_1'),
    );
    expect(isMultiSpeaker(cues)).toBe(true);
  });

  it('90% 단일 → 1인 (80% 초과)', () => {
    const cues = Array.from({ length: 10 }, (_, i) =>
      c(i + 1, i * 1000, (i + 1) * 1000, 't', i < 9 ? 'spk_0' : 'spk_1'),
    );
    expect(isMultiSpeaker(cues)).toBe(false);
  });

  it('5:5 다인', () => {
    const cues = Array.from({ length: 10 }, (_, i) =>
      c(i + 1, i * 1000, (i + 1) * 1000, 't', i < 5 ? 'spk_0' : 'spk_1'),
    );
    expect(isMultiSpeaker(cues)).toBe(true);
  });
});

describe('applyLabels', () => {
  it('빈 SpeakerMap → cue.text 그대로', () => {
    const cues = [c(1, 0, 1, 'hi', 'spk_0')];
    const result = applyLabels(cues, {});
    expect(result[0]?.text).toBe('hi');
  });

  it('cue.speakerId 없으면 prefix 미부착', () => {
    const cues = [c(1, 0, 1, 'hi')];
    const result = applyLabels(cues, { spk_0: '화자 1' });
    expect(result[0]?.text).toBe('hi');
  });

  it('cue.speakerId가 map에 없으면 prefix 미부착 (graceful)', () => {
    const cues = [c(1, 0, 1, 'hi', 'spk_99')];
    const result = applyLabels(cues, { spk_0: '화자 1' });
    expect(result[0]?.text).toBe('hi');
  });

  it('매칭 성공 시 prefix 부착', () => {
    const cues = [c(1, 0, 1, 'hi', 'spk_0'), c(2, 1, 2, 'bye', 'spk_1')];
    const result = applyLabels(cues, { spk_0: '화자 1', spk_1: '김지훈' });
    expect(result[0]?.text).toBe('[화자 1] hi');
    expect(result[1]?.text).toBe('[김지훈] bye');
  });

  it('이미 라벨이 있으면 이중 prefix 안 함', () => {
    const cues = [c(1, 0, 1, '[기존] hi', 'spk_0')];
    const result = applyLabels(cues, { spk_0: '화자 1' });
    expect(result[0]?.text).toBe('[기존] hi');
  });

  it('원본 cues는 변경하지 않음 (immutable)', () => {
    const cues = [c(1, 0, 1, 'hi', 'spk_0')];
    applyLabels(cues, { spk_0: '화자 1' });
    expect(cues[0]?.text).toBe('hi');
  });
});

describe('stripLabels', () => {
  it('prefix 없는 라인은 그대로 (회귀 0)', () => {
    const cues = [c(1, 0, 1, '그냥 텍스트')];
    const result = stripLabels(cues);
    expect(result[0]?.text).toBe('그냥 텍스트');
    expect(result[0]?.speakerId).toBeUndefined();
  });

  it('prefix가 있으면 text 분리 + speakerId 복원 (raw 이름)', () => {
    const cues = [c(1, 0, 1, '[화자 1] 안녕')];
    const result = stripLabels(cues);
    expect(result[0]?.text).toBe('안녕');
    expect(result[0]?.speakerId).toBe('화자 1');
  });

  it('speakerMap 있으면 표시명 → 화자 ID로 역매핑', () => {
    const cues = [c(1, 0, 1, '[김지훈] 안녕')];
    const result = stripLabels(cues, { spk_0: '김지훈' });
    expect(result[0]?.text).toBe('안녕');
    expect(result[0]?.speakerId).toBe('spk_0');
  });

  it('이미 cue.speakerId가 있고 매핑 실패 시 기존 ID 유지', () => {
    const cues = [c(1, 0, 1, '[unknown] 안녕', 'spk_existing')];
    const result = stripLabels(cues, { spk_0: '김지훈' });
    expect(result[0]?.text).toBe('안녕');
    expect(result[0]?.speakerId).toBe('spk_existing');
  });
});

describe('round-trip (applyLabels → stripLabels)', () => {
  it('applyLabels → stripLabels 라운드트립으로 원본 복원', () => {
    const map: SpeakerMap = { spk_0: '화자 1', spk_1: '김지훈' };
    const original = [
      c(1, 0, 1000, '안녕하세요', 'spk_0'),
      c(2, 1000, 2000, '반갑습니다', 'spk_1'),
      c(3, 2000, 3000, '오늘은', 'spk_0'),
    ];
    const labeled = applyLabels(original, map);
    const stripped = stripLabels(labeled, map);
    expect(stripped.map((x) => x.text)).toEqual(['안녕하세요', '반갑습니다', '오늘은']);
    expect(stripped.map((x) => x.speakerId)).toEqual(['spk_0', 'spk_1', 'spk_0']);
  });
});

describe('extractSpeakerIds', () => {
  it('등장 순서대로 중복 제거', () => {
    const cues = [
      c(1, 0, 1, 'a', 'spk_1'),
      c(2, 1, 2, 'b', 'spk_0'),
      c(3, 2, 3, 'c', 'spk_1'),
      c(4, 3, 4, 'd', 'spk_2'),
    ];
    expect(extractSpeakerIds(cues)).toEqual(['spk_1', 'spk_0', 'spk_2']);
  });

  it('speakerId 없는 cue는 무시', () => {
    const cues = [c(1, 0, 1, 'a'), c(2, 1, 2, 'b', 'spk_0')];
    expect(extractSpeakerIds(cues)).toEqual(['spk_0']);
  });
});

describe('buildAutoSpeakerMap', () => {
  it('1인 → 빈 객체', () => {
    const cues = Array.from({ length: 10 }, (_, i) =>
      c(i + 1, i * 1000, (i + 1) * 1000, 't', 'spk_0'),
    );
    expect(buildAutoSpeakerMap(cues)).toEqual({});
  });

  it('다인 → 등장 순서대로 "화자 1", "화자 2" ...', () => {
    const cues = Array.from({ length: 10 }, (_, i) =>
      c(i + 1, i * 1000, (i + 1) * 1000, 't', i < 5 ? 'spk_1' : 'spk_0'),
    );
    const map = buildAutoSpeakerMap(cues);
    expect(map).toEqual({ spk_1: '화자 1', spk_0: '화자 2' });
  });
});

describe('speakerDurations', () => {
  it('화자별 발화 시간 ms 집계', () => {
    const cues = [
      c(1, 0, 2000, 'a', 'spk_0'),
      c(2, 2000, 5000, 'b', 'spk_1'),
      c(3, 5000, 7000, 'c', 'spk_0'),
    ];
    const d = speakerDurations(cues);
    expect(d.get('spk_0')).toBe(4000); // 2s + 2s
    expect(d.get('spk_1')).toBe(3000);
  });
});

describe('validateSpeakerMap', () => {
  it('빈 객체는 OK', () => {
    expect(validateSpeakerMap({})).toEqual([]);
  });

  it('정상 매핑은 OK', () => {
    expect(validateSpeakerMap({ spk_0: '김지훈', spk_1: '박서연' })).toEqual([]);
  });

  it('이름 빈 문자열은 에러', () => {
    const errs = validateSpeakerMap({ spk_0: '' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('이름 30자 초과는 에러', () => {
    const errs = validateSpeakerMap({ spk_0: 'a'.repeat(31) });
    expect(errs[0]).toMatch(/30자/);
  });

  it('HTML 태그 거부', () => {
    const errs = validateSpeakerMap({ spk_0: '<script>x' });
    expect(errs[0]).toMatch(/HTML/);
  });

  it('대괄호 거부', () => {
    const errs = validateSpeakerMap({ spk_0: '[화자]' });
    expect(errs[0]).toMatch(/\[/);
  });

  it('20개 초과 키는 에러', () => {
    const map: SpeakerMap = {};
    for (let i = 0; i <= MAX_SPEAKER_MAP_KEYS; i++) {
      map[`spk_${i}`] = `화자 ${i}`;
    }
    const errs = validateSpeakerMap(map);
    expect(errs[0]).toMatch(new RegExp(String(MAX_SPEAKER_MAP_KEYS)));
  });
});
