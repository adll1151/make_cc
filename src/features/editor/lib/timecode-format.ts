/**
 * Editor UI 전용 타임코드 표시 포맷 (간략형).
 * lib/timecode.ts는 SRT 표준 (HH:MM:SS,mmm) — 너무 길어 편집기 한 줄에 부담.
 */
export function shortTimecode(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00.0';
  const totalSec = Math.round(ms / 100) / 10;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${pad(m)}:${s.toFixed(1).padStart(4, '0')}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 두 cue 사이 간격 (초) — 디버그/표시용 */
export function gapSec(prevEndMs: number, nextStartMs: number): number {
  return Math.max(0, (nextStartMs - prevEndMs) / 1000);
}
