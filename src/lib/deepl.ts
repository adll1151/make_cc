import { env } from '@/lib/env';

/**
 * DeepL REST 번역 래퍼 (subtitle-translation).
 *
 * - 외부 패키지/`lib/env`만 의존 (임포트 경계 준수).
 * - 텍스트 배열을 배치(≤50개/요청)로 번역하고, **입력 순서를 그대로 보존**해 반환한다.
 * - 429(레이트리밋)는 지수 백오프로 재시도.
 * - 무료 키(`:fx`)는 `api-free.deepl.com`, Pro 키는 `api.deepl.com` (env.DEEPL_API_URL).
 *
 * 호출 위치: 워커(worker/translate.ts). 자막 cue.text[]를 넘겨 번역본 text[]를 받는다.
 */

const MAX_BATCH = 50; // DeepL 요청당 최대 text 개수
const MAX_RETRIES = 4;

export interface DeeplOptions {
  /** 원문 언어 (DeepL 코드, 예: 'KO'). 미지정 시 DeepL 자동감지. */
  sourceLang?: string;
  /** 대상 언어 (DeepL 코드, 예: 'EN-US', 'JA', 'ZH'). 필수. */
  targetLang: string;
  /** 배치 완료마다 호출(진행률). translated 누적 개수 / 전체 개수. */
  onProgress?: (done: number, total: number) => void;
}

export class DeeplError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'DeeplError';
  }
}

/**
 * 텍스트 배열을 DeepL로 번역. 입력 순서와 길이가 보존된 배열을 반환한다.
 * 빈 문자열은 호출하지 않고 그대로 빈 문자열로 매핑(문자/쿼터 절약).
 */
export async function deeplTranslate(texts: string[], opts: DeeplOptions): Promise<string[]> {
  if (texts.length === 0) return [];
  if (!env.DEEPL_API_KEY) {
    throw new DeeplError('DEEPL_API_KEY 미설정 — 번역을 수행할 수 없습니다.');
  }

  const result = new Array<string>(texts.length);
  // 번역이 필요한 인덱스만 추림(빈 문자열 제외)
  const targets: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (texts[i]!.trim().length === 0) {
      result[i] = texts[i]!;
    } else {
      targets.push(i);
    }
  }

  let done = 0;
  for (let b = 0; b < targets.length; b += MAX_BATCH) {
    const idxBatch = targets.slice(b, b + MAX_BATCH);
    const batchTexts = idxBatch.map((i) => texts[i]!);
    const translated = await translateBatch(batchTexts, opts);
    idxBatch.forEach((origIdx, k) => {
      result[origIdx] = translated[k] ?? texts[origIdx]!;
    });
    done += idxBatch.length;
    opts.onProgress?.(done, targets.length);
  }

  return result;
}

async function translateBatch(texts: string[], opts: DeeplOptions): Promise<string[]> {
  const url = `${env.DEEPL_API_URL.replace(/\/$/, '')}/v2/translate`;
  const body: Record<string, unknown> = {
    text: texts,
    target_lang: opts.targetLang,
    preserve_formatting: true,
  };
  if (opts.sourceLang) body.source_lang = opts.sourceLang;

  let attempt = 0;
  // 지수 백오프: 1s, 2s, 4s, 8s
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // 네트워크 오류도 재시도 대상
      if (attempt >= MAX_RETRIES) {
        throw new DeeplError(`DeepL 네트워크 오류: ${(err as Error)?.message ?? 'unknown'}`);
      }
      await sleep(backoffMs(attempt++));
      continue;
    }

    if (res.status === 429 || res.status === 529) {
      if (attempt >= MAX_RETRIES) {
        throw new DeeplError('DeepL 레이트리밋(429) — 잠시 후 다시 시도하세요.', res.status);
      }
      await sleep(backoffMs(attempt++));
      continue;
    }

    if (!res.ok) {
      const detail = await safeText(res);
      throw new DeeplError(`DeepL 오류 ${res.status}: ${detail}`, res.status);
    }

    const data = (await res.json()) as { translations?: Array<{ text: string }> };
    const out = data.translations?.map((t) => t.text);
    if (!out || out.length !== texts.length) {
      throw new DeeplError('DeepL 응답 형식 오류 — translations 개수 불일치');
    }
    return out;
  }
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}
