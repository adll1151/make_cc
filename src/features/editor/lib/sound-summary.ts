import type { Cue } from '@/types/subtitle';

/**
 * 리치 CC — 감지된 비음성 사운드 요약. 편집기에서 "어떤 소리가 몇 곳" 표시용.
 * 순수 함수(데이터 불변) — cue[]만 보고 집계한다.
 */

export interface SoundSummaryEntry {
  /** CC 표기 (예: '♪ 음악 ♪', '[웃음]'). */
  label: string;
  count: number;
}

/** 사운드 큐(kind='sound')를 표기(text) 기준 집계. count 내림차순, 동수는 라벨순. */
export function summarizeSoundCues(cues: Cue[]): SoundSummaryEntry[] {
  const counts = new Map<string, number>();
  for (const c of cues) {
    if (c.kind !== 'sound') continue;
    const label = c.text.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** "♪ 음악 ♪ 3 · [웃음] 2" 형태의 한 줄 요약. 사운드 큐 없으면 빈 문자열. */
export function formatSoundSummary(cues: Cue[]): string {
  return summarizeSoundCues(cues)
    .map((e) => `${e.label} ${e.count}`)
    .join(' · ');
}
