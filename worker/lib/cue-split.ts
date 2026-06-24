/**
 * cue 분할 — 긴 Whisper 세그먼트(여러 문장이 한 자막에 뭉치는 문제)를
 * 가독성 좋은 짧은 cue 여러 개로 나눈다. 의존성 없는 순수 함수(테스트 용이).
 *
 * 우선순위: 문장부호(. ? ! …) 경계 > 최대 글자수 > 최대 표시시간.
 * 단어 타임스탬프(words)가 있으면 그걸로 정확히 분할(카라오케 타이밍 보존),
 * 없으면 문장 단위로 시간 비례 배분.
 */

export interface CueWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface CuePart {
  startMs: number;
  endMs: number;
  text: string;
  words?: CueWord[];
  speakerId?: string;
}

/** 튜닝 상수 */
export const MAX_CHARS = 40; // 한 cue 최대 글자수(공백 제외 근사, 2줄 분량)
export const MAX_DURATION_MS = 6000; // 한 cue 최대 표시 시간
const MIN_BREAK_CHARS = 8; // 문장부호 직후 너무 짧게 끊지 않기

const SENTENCE_END = /[.?!…。！？]$/;

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** 세그먼트 1개를 cue 여러 개로 분할. 충분히 짧으면 그대로 1개 반환. */
export function splitCue(cue: CuePart): CuePart[] {
  const text = cleanText(cue.text);
  const dur = cue.endMs - cue.startMs;
  if (text.length <= MAX_CHARS && dur <= MAX_DURATION_MS) {
    return [{ ...cue, text }];
  }
  if (cue.words && cue.words.length > 0) {
    const parts = splitByWords(cue);
    return parts.length > 0 ? parts : [{ ...cue, text }];
  }
  return splitByText(cue);
}

function splitByWords(cue: CuePart): CuePart[] {
  const words = cue.words!;
  const out: CuePart[] = [];
  let cur: CueWord[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    const first = cur[0]!;
    const last = cur[cur.length - 1]!;
    out.push({
      startMs: first.startMs,
      endMs: last.endMs,
      text: cleanText(cur.map((w) => w.text).join(' ')),
      words: cur,
      ...(cue.speakerId ? { speakerId: cue.speakerId } : {}),
    });
    cur = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    cur.push(w);
    if (i === words.length - 1) {
      flush();
      break;
    }
    const curLen = cleanText(cur.map((x) => x.text).join(' ')).length;
    const nextLen = cleanText(words[i + 1]!.text).length;
    const curDur = w.endMs - cur[0]!.startMs;
    const endsSentence = SENTENCE_END.test(w.text.trim());

    if (endsSentence && curLen >= MIN_BREAK_CHARS) flush();
    else if (curLen + nextLen + 1 > MAX_CHARS) flush();
    else if (curDur >= MAX_DURATION_MS && curLen >= MIN_BREAK_CHARS) flush();
  }
  return out;
}

function splitByText(cue: CuePart): CuePart[] {
  const text = cleanText(cue.text);
  // 문장 단위 분리(문장부호 포함해 묶음)
  const sentences =
    text.match(/[^.?!…。！？]+[.?!…。！？]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

  // 너무 긴 문장은 글자수로 추가 분할
  const parts: string[] = [];
  for (const s of sentences) {
    if (s.length <= MAX_CHARS) parts.push(s);
    else parts.push(...chunkByLength(s, MAX_CHARS));
  }
  // 인접한 아주 짧은 조각은 앞과 병합(MIN_BREAK 미만)
  const merged: string[] = [];
  for (const p of parts) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.length < MIN_BREAK_CHARS || p.length < MIN_BREAK_CHARS) && prev.length + p.length + 1 <= MAX_CHARS) {
      merged[merged.length - 1] = `${prev} ${p}`;
    } else {
      merged.push(p);
    }
  }

  // 시간 비례 배분(글자수 기준)
  const totalChars = merged.reduce((a, p) => a + p.length, 0) || 1;
  const span = cue.endMs - cue.startMs;
  let t = cue.startMs;
  return merged.map((p, idx) => {
    const d = idx === merged.length - 1 ? cue.endMs - t : Math.round((p.length / totalChars) * span);
    const startMs = t;
    const endMs = Math.min(cue.endMs, t + d);
    t = endMs;
    return {
      startMs,
      endMs,
      text: p,
      ...(cue.speakerId ? { speakerId: cue.speakerId } : {}),
    };
  });
}

/** 공백 경계 우선으로 maxLen 이하 조각들로 자른다. */
function chunkByLength(s: string, maxLen: number): string[] {
  const tokens = s.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    if (cur && cur.length + tok.length + 1 > maxLen) {
      chunks.push(cur);
      cur = tok;
    } else {
      cur = cur ? `${cur} ${tok}` : tok;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length > 0 ? chunks : [s];
}
