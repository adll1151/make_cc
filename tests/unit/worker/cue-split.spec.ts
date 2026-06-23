import { describe, it, expect } from 'vitest';
import { splitCue, MAX_CHARS, MAX_DURATION_MS, type CueWord } from '../../../worker/lib/cue-split';

/** 균등 간격 단어 생성 헬퍼 */
function words(text: string, startMs: number, endMs: number): CueWord[] {
  const toks = text.split(' ').filter(Boolean);
  const step = (endMs - startMs) / toks.length;
  return toks.map((t, i) => ({
    text: t,
    startMs: Math.round(startMs + i * step),
    endMs: Math.round(startMs + (i + 1) * step),
  }));
}

describe('splitCue', () => {
  it('짧고 한 문장이면 그대로 1개 반환', () => {
    const out = splitCue({ startMs: 0, endMs: 2000, text: '안녕하세요.' });
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('안녕하세요.');
  });

  it('긴 멀티문장(words 있음) → 문장 경계로 여러 cue 분할', () => {
    const text =
      '안녕하세요. 오늘은 한국어 자막 자동생성 데모 입니다. 영상을 업로드하면 폐쇄형 자막이 자동으로 만들어집니다.';
    const out = splitCue({ startMs: 0, endMs: 10100, text, words: words(text, 0, 10100) });
    expect(out.length).toBeGreaterThan(1);
    // 각 cue는 글자수/시간 상한 이내(여유 포함)
    for (const c of out) {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHARS + 5);
      expect(c.endMs - c.startMs).toBeLessThanOrEqual(MAX_DURATION_MS + 1500);
      expect(c.words && c.words.length).toBeGreaterThan(0);
    }
    // 시간 단조 증가 + 범위 유지
    expect(out[0]!.startMs).toBe(0);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.startMs).toBeGreaterThanOrEqual(out[i - 1]!.endMs - 1);
    }
    // 마지막 끝은 원본 범위 이내
    expect(out[out.length - 1]!.endMs).toBeLessThanOrEqual(10100);
  });

  it('words 없음 → 문장 단위 분할 + 시간 비례 배분', () => {
    const text = '첫 번째 문장입니다. 두 번째로 조금 더 긴 문장이 이어집니다. 세 번째 마지막 문장.';
    const out = splitCue({ startMs: 1000, endMs: 9000, text });
    expect(out.length).toBeGreaterThan(1);
    expect(out[0]!.startMs).toBe(1000);
    expect(out[out.length - 1]!.endMs).toBe(9000);
    // 단조 증가
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.startMs).toBe(out[i - 1]!.endMs);
    }
  });

  it('문장부호 없는 아주 긴 문장 → 글자수 상한으로 분할', () => {
    const text = '가나다라마바사아자차카타파하 '.repeat(6).trim();
    const out = splitCue({ startMs: 0, endMs: 12000, text });
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) expect(c.text.length).toBeLessThanOrEqual(MAX_CHARS + 5);
  });

  it('speakerId는 분할된 모든 cue에 보존', () => {
    const text = '첫 문장입니다. 두 번째 문장도 충분히 길게 이어서 만들어 봅니다 정말로.';
    const out = splitCue({ startMs: 0, endMs: 8000, text, speakerId: 'SPEAKER_01' });
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) expect(c.speakerId).toBe('SPEAKER_01');
  });
});
