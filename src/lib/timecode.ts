/**
 * 타임코드 변환 — 순수 함수, 외부 의존성 없음.
 *
 * SRT 포맷: "HH:MM:SS,mmm" (쉼표 구분자)
 * VTT 포맷: "HH:MM:SS.mmm" (마침표 구분자)
 *
 * 모든 시간은 내부적으로 ms 정수.
 */

export type TimecodeFormat = 'srt' | 'vtt';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

const SRT_REGEX = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/;
const VTT_REGEX = /^(\d{2,}):([0-5]\d):([0-5]\d)\.(\d{3})$/;
/** VTT는 MM:SS.mmm 단축도 허용 */
const VTT_SHORT_REGEX = /^([0-5]?\d):([0-5]\d)\.(\d{3})$/;

/** ms → "HH:MM:SS,mmm" (SRT) 또는 "HH:MM:SS.mmm" (VTT) */
export function formatTimecode(ms: number, format: TimecodeFormat = 'srt'): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`타임코드는 0 이상의 유한수여야 합니다 (받은 값: ${ms})`);
  }
  const total = Math.round(ms);
  const hh = Math.floor(total / MS_PER_HOUR);
  const mm = Math.floor((total % MS_PER_HOUR) / MS_PER_MINUTE);
  const ss = Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND);
  const msec = total % MS_PER_SECOND;

  const sep = format === 'srt' ? ',' : '.';
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${sep}${pad3(msec)}`;
}

/** "HH:MM:SS,mmm" 또는 "HH:MM:SS.mmm" → ms */
export function parseTimecode(input: string, format?: TimecodeFormat): number {
  const trimmed = input.trim();

  if (format === 'srt' || !format) {
    const m = SRT_REGEX.exec(trimmed);
    if (m) return toMs(m[1]!, m[2]!, m[3]!, m[4]!);
    if (format === 'srt') {
      throw new SyntaxError(`SRT 타임코드 형식이 아닙니다: "${trimmed}"`);
    }
  }

  if (format === 'vtt' || !format) {
    const m = VTT_REGEX.exec(trimmed);
    if (m) return toMs(m[1]!, m[2]!, m[3]!, m[4]!);
    const short = VTT_SHORT_REGEX.exec(trimmed);
    if (short) return toMs('00', short[1]!, short[2]!, short[3]!);
  }

  throw new SyntaxError(`알 수 없는 타임코드 형식: "${trimmed}"`);
}

function toMs(hhStr: string, mmStr: string, ssStr: string, msStr: string): number {
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const ss = Number(ssStr);
  const ms = Number(msStr);
  return hh * MS_PER_HOUR + mm * MS_PER_MINUTE + ss * MS_PER_SECOND + ms;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

export const TIMECODE_UNITS = {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
} as const;
