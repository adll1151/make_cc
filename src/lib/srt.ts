import { formatTimecode, parseTimecode } from '@/lib/timecode';
import type { Cue, SpeakerMap } from '@/types/subtitle';
import { applyLabels, stripLabels } from '@/lib/srt-labeling';

/**
 * SRT 파서/빌더 — 순수 함수, 외부 의존성 없음.
 *
 * SRT 표준:
 *   1
 *   00:00:00,000 --> 00:00:02,400
 *   첫 번째 자막 텍스트
 *
 *   2
 *   00:00:02,500 --> 00:00:05,800
 *   두 번째 자막
 *   두 줄도 가능
 *
 * 관용 처리:
 *   - BOM(﻿) 제거
 *   - CRLF / CR / LF 모두 허용
 *   - 마지막 공백 라인 옵션
 *   - 인덱스 누락/중복 — 재할당
 *   - 빈 cue (text 없음) → skip
 */

const TIME_LINE = /^(\d{2,}:[0-5]\d:[0-5]\d[,.]\d{3})\s*-->\s*(\d{2,}:[0-5]\d:[0-5]\d[,.]\d{3})(\s.*)?$/;

export interface SrtParseOptions {
  /** 인덱스 충돌 시 자동 재할당 (default true) */
  reindex?: boolean;
  /** 텍스트 라인 최대 길이 — 초과 시 throw (default 200) */
  maxTextLength?: number;
  /**
   * 화자 라벨 prefix(`[화자 1] ...`)를 분리하여 cue.text는 순수 텍스트,
   * speakerId는 prefix 매핑으로 채운다. (default false — 기존 동작 유지)
   *
   * speakerMap이 전달되면 표시 이름 → 화자 ID로 역매핑한다.
   * 없으면 raw label 텍스트를 speakerId로 사용.
   */
  extractLabels?: boolean;
  /** extractLabels = true일 때 역매핑용 SpeakerMap */
  speakerMap?: SpeakerMap;
}

export interface SrtBuildOptions {
  /** 인덱스를 1부터 재할당 (default true) */
  reindex?: boolean;
  /** 끝에 빈 줄 추가 (대부분 플레이어 호환, default true) */
  trailingNewline?: boolean;
  /**
   * 전달되면 cue.text 앞에 `[표시명] ` prefix를 부착해 빌드.
   * 빈 객체 / 미전달 시 평문 SRT (기존 동작).
   */
  speakerMap?: SpeakerMap;
}

/** SRT 텍스트 → Cue[] */
export function parseSrt(input: string, opts: SrtParseOptions = {}): Cue[] {
  const { reindex = true, maxTextLength = 200, extractLabels = false, speakerMap } = opts;

  // BOM 제거 + 줄바꿈 정규화
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (text.length === 0) return [];

  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.replace(/\s+$/, ''));
    if (lines.length === 0) continue;

    // 첫 줄이 숫자면 index, 아니면 시간라인일 수도
    let i = 0;
    let parsedIndex: number | undefined;
    if (/^\d+$/.test(lines[i]!)) {
      parsedIndex = Number(lines[i]);
      i += 1;
    }
    const timeMatch = TIME_LINE.exec(lines[i] ?? '');
    if (!timeMatch) {
      throw new SyntaxError(
        `SRT 파싱 실패: 타임코드 라인을 찾을 수 없습니다. block="${block.slice(0, 80)}"`,
      );
    }
    const startMs = parseTimecode(timeMatch[1]!);
    const endMs = parseTimecode(timeMatch[2]!);
    if (startMs >= endMs) {
      throw new SyntaxError(`SRT 파싱 실패: startMs(${startMs}) >= endMs(${endMs})`);
    }
    i += 1;

    const textLines = lines.slice(i).filter((l) => l.length > 0);
    if (textLines.length === 0) continue; // 빈 cue skip

    const joinedText = textLines.join('\n');
    if (joinedText.length > maxTextLength) {
      throw new SyntaxError(
        `SRT 파싱 실패: 텍스트 길이(${joinedText.length}) > 최대(${maxTextLength})`,
      );
    }
    if (/<[a-z]/i.test(joinedText)) {
      throw new SyntaxError('SRT 파싱 실패: HTML 태그는 허용되지 않습니다.');
    }

    cues.push({
      index: parsedIndex ?? cues.length + 1,
      startMs,
      endMs,
      text: joinedText,
    });
  }

  if (reindex) {
    cues.forEach((c, idx) => {
      c.index = idx + 1;
    });
  }

  if (extractLabels) {
    return stripLabels(cues, speakerMap);
  }

  return cues;
}

/** Cue[] → SRT 텍스트 */
export function buildSrt(cues: Cue[], opts: SrtBuildOptions = {}): string {
  const { reindex = true, trailingNewline = true, speakerMap } = opts;

  // 라벨 적용 (있을 때만, 빈 객체면 no-op)
  const labeled = speakerMap && Object.keys(speakerMap).length > 0
    ? applyLabels(cues, speakerMap)
    : cues;

  const out: string[] = [];
  labeled.forEach((cue, idx) => {
    const index = reindex ? idx + 1 : cue.index;
    if (cue.startMs >= cue.endMs) {
      throw new RangeError(
        `buildSrt 실패: cue[${idx}] startMs(${cue.startMs}) >= endMs(${cue.endMs})`,
      );
    }
    out.push(String(index));
    out.push(`${formatTimecode(cue.startMs, 'srt')} --> ${formatTimecode(cue.endMs, 'srt')}`);
    out.push(cue.text);
    out.push(''); // 블록 구분 빈 줄
  });

  if (!trailingNewline && out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out.join('\n');
}

export interface OverlapIssue {
  prevIndex: number;
  nextIndex: number;
  overlapMs: number;
}

/**
 * Cue 시간 정합성 검증:
 *   - 인접 cue끼리 시간 겹침 없음
 *   - 시간이 단조 증가
 *   - 각 cue의 startMs < endMs
 *
 * 위반 사항을 리스트로 반환 (빈 배열이면 OK).
 */
export function validateCues(cues: Cue[]): OverlapIssue[] {
  const issues: OverlapIssue[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cur = cues[i]!;
    if (cur.startMs >= cur.endMs) {
      issues.push({ prevIndex: cur.index, nextIndex: cur.index, overlapMs: cur.startMs - cur.endMs });
      continue;
    }
    if (i === 0) continue;
    const prev = cues[i - 1]!;
    if (prev.endMs > cur.startMs) {
      issues.push({
        prevIndex: prev.index,
        nextIndex: cur.index,
        overlapMs: prev.endMs - cur.startMs,
      });
    }
  }
  return issues;
}

/** 텍스트 끝의 공백 정리 + 빈 cue 제거 */
export function normalizeCues(cues: Cue[]): Cue[] {
  return cues
    .map((c) => ({ ...c, text: c.text.replace(/\s+$/g, '').replace(/^\s+/g, '') }))
    .filter((c) => c.text.length > 0)
    .map((c, idx) => ({ ...c, index: idx + 1 }));
}
