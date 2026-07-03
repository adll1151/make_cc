import { describe, it, expect } from 'vitest';
import {
  mapCcLabel,
  eventsToSoundCues,
  localizeSoundCue,
  MIN_CONFIDENCE,
  type RawSoundEvent,
} from '../../../worker/lib/sound-events';

const ev = (startMs: number, endMs: number, label: string, prob: number): RawSoundEvent => ({
  startMs,
  endMs,
  label,
  prob,
});

describe('mapCcLabel — AudioSet 라벨 → CC 표기', () => {
  it('음악군 → ♪ 음악 ♪', () => {
    for (const l of ['Music', 'Singing', 'A capella', 'A cappella', 'Vocal music', 'Choir', 'Song'])
      expect(mapCcLabel(l)).toBe('♪ 음악 ♪');
  });
  it('웃음군 → [웃음]', () => {
    for (const l of ['Laughter', 'Giggle', 'Snicker', 'Chuckle, chortle'])
      expect(mapCcLabel(l)).toBe('[웃음]');
  });
  it('박수군 → [박수]', () => {
    for (const l of ['Applause', 'Clapping', 'Cheering']) expect(mapCcLabel(l)).toBe('[박수]');
  });
  it('울음군 → [울음]', () => {
    for (const l of ['Crying, sobbing', 'Baby cry, infant cry', 'Whimper'])
      expect(mapCcLabel(l)).toBe('[울음]');
  });
  it('기침/재채기', () => {
    expect(mapCcLabel('Cough')).toBe('[기침]');
    expect(mapCcLabel('Sneeze')).toBe('[재채기]');
  });
  it('대사(Speech)·기타는 null (CC 대상 아님)', () => {
    expect(mapCcLabel('Speech')).toBeNull();
    expect(mapCcLabel('Male speech, man speaking')).toBeNull();
    expect(mapCcLabel('Siren')).toBeNull();
    expect(mapCcLabel('Dog')).toBeNull();
  });
});

describe('eventsToSoundCues — 임계·매핑·병합', () => {
  it('임계 미만 이벤트 버림', () => {
    const cues = eventsToSoundCues([ev(0, 2000, 'Laughter', MIN_CONFIDENCE - 0.01)]);
    expect(cues).toHaveLength(0);
  });

  it('CC 대상 아닌 라벨 버림(Speech)', () => {
    const cues = eventsToSoundCues([ev(0, 2000, 'Speech', 0.98)]);
    expect(cues).toHaveLength(0);
  });

  it('인접 동일 CC 창들을 하나로 병합(음악 연속)', () => {
    const cues = eventsToSoundCues([
      ev(0, 2000, 'A capella', 0.86),
      ev(1000, 3000, 'Music', 0.9),
      ev(2000, 4000, 'Singing', 0.8),
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.text).toBe('♪ 음악 ♪');
    expect(cues[0]!.kind).toBe('sound');
    expect(cues[0]!.startMs).toBe(0);
    expect(cues[0]!.endMs).toBe(4000);
    // 최고 확률 라벨을 대표 soundTag로
    expect(cues[0]!.soundTag).toBe('Music');
  });

  it('다른 CC는 별도 큐(웃음/음악)', () => {
    const cues = eventsToSoundCues([
      ev(0, 2000, 'Laughter', 0.8),
      ev(5000, 7000, 'Music', 0.9),
    ]);
    expect(cues.map((c) => c.text)).toEqual(['[웃음]', '♪ 음악 ♪']);
    expect(cues.every((c) => c.kind === 'sound')).toBe(true);
  });

  it('간격이 크면(gap 초과) 같은 CC라도 분리', () => {
    const cues = eventsToSoundCues(
      [ev(0, 2000, 'Music', 0.9), ev(10000, 12000, 'Music', 0.9)],
      { mergeGapMs: 1500 },
    );
    expect(cues).toHaveLength(2);
  });

  it('최소 지속 미만 큐 제거', () => {
    const cues = eventsToSoundCues([ev(0, 300, 'Cough', 0.9)], { minDurationMs: 500 });
    expect(cues).toHaveLength(0);
  });

  it('index는 1부터 순차 부여', () => {
    const cues = eventsToSoundCues([
      ev(0, 2000, 'Laughter', 0.8),
      ev(5000, 7000, 'Applause', 0.7),
    ]);
    expect(cues.map((c) => c.index)).toEqual([1, 2]);
  });
});

describe('localizeSoundCue — CC 표기 대상 언어 로컬라이즈', () => {
  it('음악/웃음/박수 등을 언어별 CC 표기로 치환', () => {
    expect(localizeSoundCue('♪ 음악 ♪', 'en')).toBe('♪ Music ♪');
    expect(localizeSoundCue('♪ 음악 ♪', 'ja')).toBe('♪ 音楽 ♪');
    expect(localizeSoundCue('♪ 음악 ♪', 'zh')).toBe('♪ 音乐 ♪');
    expect(localizeSoundCue('[웃음]', 'en')).toBe('[Laughter]');
    expect(localizeSoundCue('[박수]', 'ja')).toBe('[拍手]');
    expect(localizeSoundCue('[기침]', 'zh')).toBe('[咳嗽]');
  });

  it('앞뒤 공백이 있어도 매칭(trim)', () => {
    expect(localizeSoundCue('  [웃음] ', 'en')).toBe('[Laughter]');
  });

  it('CC_RULES가 내는 모든 표기는 en/ja/zh 매핑이 존재', () => {
    for (const cc of ['♪ 음악 ♪', '[웃음]', '[박수]', '[울음]', '[기침]', '[재채기]']) {
      for (const lang of ['en', 'ja', 'zh']) {
        expect(localizeSoundCue(cc, lang)).not.toBe(cc); // 원본과 달라야(=매핑됨)
      }
    }
  });

  it('매핑/미지원 언어는 원본 유지', () => {
    expect(localizeSoundCue('[웃음]', 'fr')).toBe('[웃음]'); // 미지원 언어
    expect(localizeSoundCue('안녕하세요', 'en')).toBe('안녕하세요'); // 사운드 큐 아님
  });
});
