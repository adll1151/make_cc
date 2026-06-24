/**
 * 번역 대상 언어 설정 (subtitle-translation).
 *
 * 단일 출처(single source of truth): 내부 코드 ↔ DeepL 코드 매핑 + 표시 메타.
 * 언어 확장은 이 배열에 항목만 추가하면 된다(DeepL 지원 범위 내).
 *   - 내부 코드: 짧은 소문자(en/ja/zh ...) — storage 키 접미사·DB target_lang에 사용.
 *   - DeepL 코드: DeepL target_lang 규격(EN-US/JA/ZH ...).
 *
 * 원문은 항상 한국어(ko / DeepL 'KO').
 */

export const SOURCE_LANG = 'ko' as const;
export const SOURCE_DEEPL = 'KO' as const;

export interface SupportedLanguage {
  /** 내부 코드 (en, ja, zh ...) */
  code: string;
  /** DeepL target 코드 (EN-US, JA, ZH ...) */
  deepl: string;
  /** 표시명 (네이티브) */
  nativeName: string;
  /** 국기 이모지 */
  flag: string;
}

// 초기 노출: 영·일·중. 확장은 아래 배열에 추가만.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', deepl: 'EN-US', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', deepl: 'JA', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', deepl: 'ZH', nativeName: '中文', flag: '🇨🇳' },
];

const BY_CODE = new Map(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));

/** 내부 코드 → DeepL 코드. 미지원이면 null. */
export function toDeeplCode(code: string): string | null {
  return BY_CODE.get(code)?.deepl ?? null;
}

/** 지원 언어 화이트리스트 검사. */
export function isSupportedLang(code: string): boolean {
  return BY_CODE.has(code);
}

/** 내부 코드 → 메타. 미지원이면 null. */
export function getLanguage(code: string): SupportedLanguage | null {
  return BY_CODE.get(code) ?? null;
}
