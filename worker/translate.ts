import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { parseSrt, buildSrt } from '@/lib/srt';
import { deeplTranslate, DeeplError } from '@/lib/deepl';
import { getJobAdmin } from '@/services/jobs';
import { getSubtitleText, saveTranslatedSubtitle } from '@/services/storage';
import {
  getTranslationAdmin,
  markTranslationTranslating,
  updateTranslationProgress,
  markTranslationDone,
  markTranslationFailed,
} from '@/services/translation';
import { toDeeplCode, SOURCE_DEEPL } from '@/services/translation/languages';

/**
 * 번역 잡 처리 (subtitle-translation) — 워커·CLI 양쪽이 호출.
 *
 * STT/렌더 워커와 동일 흐름이나 **GPU/python 불필요, 순수 TS + DeepL REST**.
 *
 * 단계 (Design §8.1):
 *   1. translation + job 로드, pending→translating 전이(동시픽업 가드)
 *   2. 원본 한국어 SRT 로드 → parseSrt
 *   3. 문자수 상한 검사(TRANSLATION_MAX_CHARS_PER_JOB)
 *   4. cue.text[] → DeepL 번역(진행률 갱신), 타임스탬프/words/index 보존
 *   5. buildSrt → saveTranslatedSubtitle({jobId}.{lang}.srt)
 *   6. status=done (+output_delete_at). 실패 시 failed + 사유.
 */

/** 출력 보존: 회원 7일 / 무료(게스트) 24시간. (render와 동일 정책) */
function computeOutputDeleteAt(isUser: boolean): Date {
  const d = new Date();
  if (isUser) d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCHours(d.getUTCHours() + 24);
  return d;
}

export interface ProcessTranslationResult {
  translationId: string;
  outputStorageKey: string;
  targetLang: string;
  cueCount: number;
  charCount: number;
  elapsedSec: number;
}

export async function processTranslation(translationId: string): Promise<ProcessTranslationResult> {
  const log = logger.child({ translationId, worker: 'translate' });
  const start = Date.now();

  const translation = await getTranslationAdmin(translationId);
  if (!translation) throw new Error(`translation ${translationId} not found`);

  const job = await getJobAdmin(translation.jobId);
  if (!job) throw new Error(`job ${translation.jobId} (translation ${translationId}) not found`);
  if (job.status !== 'finished') {
    throw new Error(`job ${translation.jobId} not finished (status=${job.status}) — 자막 필요`);
  }

  const deeplTarget = toDeeplCode(translation.targetLang);
  if (!deeplTarget) {
    await safeFail(translationId, 'UNSUPPORTED_LANG', `지원하지 않는 언어: ${translation.targetLang}`, log);
    throw new Error(`unsupported target lang: ${translation.targetLang}`);
  }

  // pending → translating (다른 워커가 이미 가져갔으면 중단)
  const claimed = await markTranslationTranslating(translationId);
  if (!claimed) {
    log.warn('translation already claimed/처리됨 — skip');
    throw new Error(`translation ${translationId} not in pending state`);
  }

  log.info({ jobId: translation.jobId, targetLang: translation.targetLang, deeplTarget }, 'start translate');

  try {
    // 1. 원본 SRT 로드 + 파싱
    const srt = await getSubtitleText(translation.jobId);
    const cues = parseSrt(srt);
    if (cues.length === 0) throw new Error('원본 자막 cue가 없습니다.');

    // 2. 문자수 상한 검사 (무료 한도 보호)
    const charCount = cues.reduce((sum, c) => sum + c.text.length, 0);
    if (charCount > env.TRANSLATION_MAX_CHARS_PER_JOB) {
      await safeFail(
        translationId,
        'CHAR_LIMIT',
        `번역 문자 수(${charCount})가 상한(${env.TRANSLATION_MAX_CHARS_PER_JOB})을 초과했습니다.`,
        log,
      );
      throw new Error(`char limit exceeded: ${charCount}`);
    }

    // 3. DeepL 번역 (진행률 갱신, ≥2% 변화 시에만 fire-and-forget)
    let lastWritten = 0;
    const texts = cues.map((c) => c.text);
    const translated = await deeplTranslate(texts, {
      sourceLang: SOURCE_DEEPL,
      targetLang: deeplTarget,
      onProgress: (done, total) => {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        if (pct - lastWritten < 2) return;
        lastWritten = pct;
        void updateTranslationProgress(translationId, pct).catch((e) =>
          log.warn({ err: (e as Error)?.message, pct }, 'updateTranslationProgress 실패(무시)'),
        );
      },
    });

    // 4. cue.text만 교체 (index/startMs/endMs/words/speakerId 원본 보존)
    const translatedCues = cues.map((c, i) => ({ ...c, text: translated[i] ?? c.text }));
    const outSrt = buildSrt(translatedCues);

    // 5. 저장
    const { path: key } = await saveTranslatedSubtitle({
      jobId: translation.jobId,
      lang: translation.targetLang,
      srtText: outSrt,
    });

    // 6. 완료
    const deleteAt = computeOutputDeleteAt(job.ownerType === 'user');
    await markTranslationDone({
      translationId,
      outputStorageKey: key,
      charCount,
      outputDeleteAt: deleteAt,
    });

    const elapsedSec = (Date.now() - start) / 1000;
    log.info(
      { key, cueCount: cues.length, charCount, elapsedSec: elapsedSec.toFixed(1) },
      'translate done',
    );
    return {
      translationId,
      outputStorageKey: key,
      targetLang: translation.targetLang,
      cueCount: cues.length,
      charCount,
      elapsedSec,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof DeeplError ? 'DEEPL_ERROR' : 'TRANSLATE_FAILED';
    log.error({ err: errorMessage }, 'translate failed');
    await safeFail(translationId, errorCode, errorMessage, log);
    throw err;
  }
}

/** markTranslationFailed 래퍼 — 실패 기록 자체의 예외는 로그만(원 예외 전파 우선). */
async function safeFail(
  translationId: string,
  errorCode: string,
  errorMessage: string,
  log: ReturnType<typeof logger.child>,
): Promise<void> {
  try {
    await markTranslationFailed({ translationId, errorCode, errorMessage });
  } catch (markErr) {
    log.error({ markErr: (markErr as Error)?.message }, 'markTranslationFailed 실패');
  }
}
