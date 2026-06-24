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

/** 편집용 정밀 포맷 mm:ss.mmm (타임코드 입력 필드). */
export function formatEditTimecode(ms: number): string {
  const v = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  const m = Math.floor(v / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const mmm = v % 1000;
  return `${pad(m)}:${pad(s)}.${String(mmm).padStart(3, '0')}`;
}

/**
 * 편집 타임코드 파싱. 허용: `mm:ss.mmm`, `mm:ss`, `ss.mmm`, `ss` (구분자 . 또는 ,).
 * 실패 시 null.
 */
export function parseEditTimecode(input: string): number | null {
  const t = input.trim();
  const m = t.match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  const secs = parseInt(m[2]!, 10);
  if (secs > 59) return null;
  const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
  return (mins * 60 + secs) * 1000 + frac;
}
