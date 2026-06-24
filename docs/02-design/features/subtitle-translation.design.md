---
template: design
version: 1.0
feature: subtitle-translation
date: 2026-06-24
author: shong7500
project: make_cc
status: Draft
phase: phase-3
architecture: C-Pragmatic
plan_ref: docs/01-plan/features/subtitle-translation.plan.md
---

# 자막 번역(다국어) Design Document — phase3

> **Architecture**: **Option C (Pragmatic)** — `translations` 테이블이 기존 `renders` 도메인을 미러. `services/translation` 신설, 워커 `poll-loop` 분기 재활용(전용 큐 없음), `/api/translations` + SSE, **번역은 워커에서 DeepL REST 호출**(GPU 불필요).
> **Engine**: **DeepL API Free**(월 50만자 무료) — 자금 부족 제약 하 "$0" 선택. `lib/deepl.ts` REST 래퍼.

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 한국어 단일 트랙 한계로 글로벌 도달 불가. 경쟁사 전부가 가진 필수 기능을 메워 시장 확장. |
| **WHO** | 해외 시청자 노리는 유튜버/쇼츠 크리에이터. 1차 ICP: K-콘텐츠 → 영·일·중. |
| **RISK** | ① DeepL 무료 한도(50만자/월) 초과 ② 타이밍 싱크(타임스탬프 보존) ③ 워커 가동 의존 ④ 게이팅 우회 ⑤ DeepL 429 레이트리밋. |
| **SUCCESS** | 한국어 SRT 보유 잡 → 대상 언어 선택 → 번역 잡 finished → 언어별 SRT 다운로드 + 번인 렌더 언어 선택까지 E2E. 타임스탬프 100% 보존. |
| **SCOPE** | IN: DeepL 번역, 언어별 SRT 트랙, 편집기 언어 탭, 언어별 다운로드, 번인 언어 선택, 게이팅, 비용 가드. OUT: AI 더빙/TTS, 음성번역, 자동클립, 실시간번역. |

---

## 1. Overview

완성된 한국어 자막(`subtitles` 버킷의 `{jobId}.srt`)을 입력으로, 사용자가 고른 대상 언어로 **DeepL**이 cue 텍스트만 번역하고 **타임스탬프·인덱스·words는 원본 유지**한 채 재조립해 `{jobId}.{lang}.srt`로 저장한다. 처리는 `translations` 테이블 + 워커 `poll-loop` 분기로 비동기 수행하며, 편집기에서 언어 탭으로 검수·다운로드하고 번인 렌더도 언어를 선택할 수 있다.

**선택 아키텍처 C 근거**: 워커는 어차피 STT용으로 가동되므로 같은 poll-loop에 번역 분기만 추가 → 추가 인프라 0. DeepL은 GPU 불필요라 워커에서 REST 호출만으로 충분하고, 잡 큐 방식이라 긴 영상·429에도 진행률/재시도 확보. 기존 renders 패턴을 그대로 미러해 일관성↑.

---

## 2. 핵심 결정 요약

| 항목 | 결정 |
|------|------|
| 번역 엔진 | **DeepL API Free** (`api-free.deepl.com`, `DeepL-Auth-Key`) |
| 실행 | 워커 `poll-loop` 분기(렌더·STT와 동일 우선순위 스캔), DeepL REST는 워커에서 호출 |
| DB | `translations` 테이블(renders 미러: pending→translating→done/failed) |
| 게이팅 | 무료 **잡당 1언어**, Pro 무제한. `readIsPro` 재활용 |
| 언어 | `SUPPORTED_LANGUAGES` 상수(설정 기반 확장), 초기 노출 영·일·중 |
| 비용 가드 | 잡당 문자 상한 + (P2) 월 누적 카운터 |
| 타임스탬프 | cue.text만 교체, index/startMs/endMs/words 원본 유지 |

---

## 3. 데이터 모델

### 3.1 신규 테이블 `translations` (renders 미러)

`supabase/migrations/{ts}_translations.sql`:

```sql
create table public.translations (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'translating', 'done', 'failed')),

  source_lang text not null default 'ko',
  target_lang text not null,                 -- 내부 코드 (en/ja/zh ...)
  engine text not null default 'deepl',

  output_storage_key text,                   -- {yyyy}/{mm}/{jobId}/{jobId}.{target_lang}.srt
  char_count int,                            -- 번역 문자 수(비용 추적)
  error_code text,
  error_message text,
  progress_percent int not null default 0,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  output_delete_at timestamptz               -- 게스트 자산 만료(cleanup)
);

create index translations_job_id_idx on public.translations(job_id);
create index translations_status_idx on public.translations(status);
-- 같은 잡+언어 중복 방지(재번역은 기존 행 갱신 또는 삭제 후 재생성)
create unique index translations_job_lang_uniq on public.translations(job_id, target_lang);

-- RLS: 본인 user_id 또는 service_role만. 게스트 잡은 admin 경로로 처리(기존 renders와 동일 정책 미러).
alter table public.translations enable row level security;
-- (정책 SQL은 renders 마이그레이션의 정책을 미러하여 작성)
```

> `database.types.ts`에 `translations` Row/Insert/Update 추가(renders 타입 구조 미러). `npm run db:gen-types` 또는 수기.

### 3.2 `renders` 컬럼 추가 (번인 언어)

```sql
alter table public.renders add column subtitle_lang text not null default 'ko';
```

### 3.3 타입 (`src/types/`)

```typescript
// src/types/translation.ts
export type TranslationStatus = 'pending' | 'translating' | 'done' | 'failed';

export interface TranslationView {
  id: string;
  jobId: string;
  sourceLang: string;
  targetLang: string;
  status: TranslationStatus;
  progressPercent: number;
  downloadUrl?: string;   // done일 때 signed URL
  errorCode?: string;
}
```

---

## 4. 언어 설정 (확장형)

`src/services/translation/languages.ts`:

```typescript
export interface SupportedLanguage {
  code: string;       // 내부 코드 (en, ja, zh, es ...)
  deepl: string;      // DeepL target 코드 (EN-US, JA, ZH, ES ...)
  nativeName: string; // 표시명 (English, 日本語, 中文 ...)
  flag: string;       // 🇺🇸 🇯🇵 🇨🇳
}

// 초기 노출: 영·일·중. 확장은 배열에 추가만.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', deepl: 'EN-US', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', deepl: 'JA',    nativeName: '日本語',   flag: '🇯🇵' },
  { code: 'zh', deepl: 'ZH',    nativeName: '中文',     flag: '🇨🇳' },
];

export function toDeeplCode(code: string): string | null { /* 매핑 단일 출처 */ }
export function isSupportedLang(code: string): boolean { /* 화이트리스트 */ }
```

---

## 5. 인프라 계층 (`lib/`)

### 5.1 `src/lib/deepl.ts` (신규)

```typescript
// 외부 패키지/types만 의존 (임포트 경계 준수)
export interface DeeplOptions { sourceLang?: string; targetLang: string; }

/** DeepL REST. 텍스트 배열을 배치(≤50개/요청) 번역. 429 지수백오프 재시도. */
export async function deeplTranslate(
  texts: string[],
  opts: DeeplOptions,
): Promise<string[]>;
```

- 엔드포인트: `env.DEEPL_API_URL`(기본 `https://api-free.deepl.com`) `/v2/translate`
- 인증: `Authorization: DeepL-Auth-Key {env.DEEPL_API_KEY}`
- 배치: DeepL은 요청당 최대 50개 `text[]` → cue를 50개씩 나눠 호출, 진행률 콜백
- 레이트리밋: 429 시 지수백오프(예: 1s→2s→4s, 최대 N회), 실패 시 throw
- `tag_handling` 미사용(평문), `preserve_formatting=1`

### 5.2 `src/lib/env.ts` 추가

```typescript
DEEPL_API_KEY: z.string().min(1),                 // 서버 전용
DEEPL_API_URL: z.string().url().default('https://api-free.deepl.com'),
TRANSLATION_MAX_CHARS_PER_JOB: z.coerce.number().int().default(50_000), // 비용 가드
```

> 단, `lib/deepl.ts`는 `lib/env` import 가능(인프라끼리). 워커도 `--env-file=.env` 사용.

### 5.3 `src/lib/storage.ts` 추가

```typescript
export function translatedSubtitleStorageKey(jobId: string, lang: string): string {
  // 기존 subtitleStorageKey와 동일 yyyy/mm 규칙 + .{lang}.srt
}
```

---

## 6. 스토리지 서비스 (`services/storage`)

```typescript
export async function saveTranslatedSubtitle(p: {
  jobId: string; lang: string; srtText: string;
}): Promise<{ bucket: string; path: string }>;

export async function getTranslatedSubtitleText(jobId: string, lang: string): Promise<string>;

export async function createTranslationDownloadUrl(p: {
  jobId: string; lang: string; expiresIn?: number;
}): Promise<string>;
```

`subtitles` 버킷 재사용. 기존 `getSubtitleText(jobId)`는 `lang?` 옵션을 받도록 확장하거나 위 신규 함수로 분리(렌더 `loadCuesForLang`에서 사용).

---

## 7. 번역 도메인 서비스 (`services/translation` 신설)

`src/services/translation/service.ts` (renders `service.ts` 미러):

```typescript
export interface TranslationOptions { targetLang: string; }

/** 번역 잡 생성. 소유검증 → finished 확인 → 게이팅 → 중복 처리 → insert(pending) → 큐(=poll-loop 픽업 대상). */
export async function createTranslation(jobId: string, opts: TranslationOptions): Promise<{ translationId: string }>;

export async function getTranslation(translationId: string): Promise<TranslationView | null>;     // 폴링(+done시 signed URL)
export async function listTranslationsByJob(jobId: string): Promise<TranslationView[]>;            // 편집기 언어 목록
export async function getTranslationStreamSnapshot(translationId: string): Promise<TranslationView | null>; // SSE(admin)

// 상태 전이 (renders 패턴)
export async function markTranslationTranslating(id: string): Promise<void>;
export async function updateTranslationProgress(id: string, pct: number): Promise<void>; // translating일 때만, 0~99 clamp
export async function markTranslationDone(id: string, storageKey: string, charCount: number): Promise<void>; // →100
export async function markTranslationFailed(id: string, code: string, message: string): Promise<void>;

export async function fetchOldestPendingTranslation(): Promise<string | null>;  // poll-loop용 (admin)
export async function cleanupExpiredTranslations(): Promise<{ scanned: number; deleted: number; errors: number }>;
```

`src/services/translation/gating.ts`:

```typescript
export const FREE_MAX_LANGS_PER_JOB = 1;
/** 무료=잡당 1언어, Pro=무제한. 초과 시 AppError(403, 'TRANSLATION_LANG_LIMIT'). */
export async function assertTranslationAllowed(p: {
  jobId: string; isPro: boolean; targetLang: string;
}): Promise<void>;  // 기존 translations 카운트 + 문자 상한(TRANSLATION_MAX_CHARS_PER_JOB) 검사
```

`createTranslation` 내부 게이팅 흐름:
1. `getOwnerContext()` → user/guest. `readIsPro(userId)`(게스트=false)
2. `assertTranslationAllowed` — 무료는 잡당 1언어 초과 차단
3. 원본 SRT 존재 확인(job finished + `{jobId}.srt`)
4. `translations` unique(job_id,target_lang) 충돌 시 기존 행 재사용/갱신

`src/services/translation/index.ts` — 위 함수 re-export(워커·API에서 import).

---

## 8. 워커 (`worker/`)

### 8.1 `worker/translate.ts` (신규) — `processTranslation`

transcribe 흐름 미러 (단, **GPU/python 불필요, 순수 TS + DeepL REST**):

```
processTranslation(translationId):
  1. translation + job 로드 (admin)
  2. markTranslationTranslating (started_at)
  3. getSubtitleText(jobId)  → 원본 한국어 SRT
  4. parseSrt(srt) → Cue[]
  5. 문자수 합산 → TRANSLATION_MAX_CHARS_PER_JOB 초과 시 fail
  6. cue.text[] 추출 → deeplTranslate(texts, {sourceLang:'ko', targetLang: toDeeplCode(lang)})
        - 50개 배치마다 updateTranslationProgress(pct)
  7. 번역 결과로 cue.text 교체(인덱스/타임스탬프/words 유지) → buildSrt(translatedCues)
  8. saveTranslatedSubtitle(jobId, lang, srtText)
  9. markTranslationDone(id, storageKey, charCount)
  (에러 → markTranslationFailed)
```

### 8.2 `worker/cli/poll-loop.ts` 분기 추가

기존 우선순위(렌더 → STT) 사이/뒤에 번역 분기 추가:

```
// 우선순위: 렌더(대화형) → 번역 → STT  (또는 렌더 → STT → 번역; 정책 택1)
const translationId = await fetchOldestPendingTranslation();
if (translationId) { await processTranslation(translationId); continue; }
```

cleanup 틱에 `cleanupExpiredTranslations()` 추가(renders cleanup 미러).

### 8.3 `worker/index.ts`

BullMQ 경로 사용 시 번역 컨슈머 추가(현재 운영은 poll-loop 기반이라 선택). MVP는 poll-loop만으로 충분.

---

## 9. API 라우트 (`app/api/translations`) — 얇은 컨트롤러

| 메서드 · 경로 | 동작 |
|---|---|
| `POST /api/translations` | `createTranslationSchema` 검증 → `createTranslation(jobId, {targetLang})` → `201 { translationId }` |
| `GET /api/translations/[id]` | `getTranslation(id)` → status/progress/(done시 downloadUrl) |
| `GET /api/translations/[id]/stream` | SSE 2s 폴링 → `getTranslationStreamSnapshot` → 변화 시 push, done/failed 종료 (renders stream 미러) |
| `GET /api/jobs/[jobId]/translations` | `listTranslationsByJob` → 편집기 언어 목록 |
| `GET /api/translations/[id]/download` | done 트랙 SRT 다운로드(또는 위 downloadUrl 사용) |

`src/app/api/translations/schema.ts`:

```typescript
export const createTranslationSchema = z.object({
  jobId: z.string().min(1).max(64),
  targetLang: z.string().refine(isSupportedLang, 'unsupported lang'),
});
```

컨트롤러는 인증/검증/응답만, 게이팅·로직은 `services/translation`. `handleApiError`로 표준 에러.

---

## 10. 프론트엔드 (`features/editor`)

### 10.1 언어 탭 + 추가

- `EditorLayout`: 데이터 로드 시 `GET /api/jobs/{jobId}/translations`로 가용 언어 목록 → 탭 바를 `[원본 ko][번역 언어들…][+ 언어 추가]`로 구성.
- `selectedLang` 상태(`useSubtitleStore` 확장: `languages: Record<lang, {cues, status}>`, `selectedLang`).
- 탭 전환 시 해당 언어 SRT 로드(원본=`/api/subtitles/{jobId}`, 번역=다운로드 URL 또는 전용 로드 라우트).
- **언어 추가 모달**: `SUPPORTED_LANGUAGES`에서 미생성 언어 선택 → `POST /api/translations` → `TranslationProgress`(SSE/폴링, renders의 `RenderProgress` 미러) → done 시 탭 추가.
- 무료 한도 초과 시 Pro 유도(번인 게이팅 톤 일치).

### 10.2 번역 자막 검수·다운로드

- 번역 탭에서도 cue 편집 가능(MVP: 최소 편집+저장 — 저장은 번역 SRT 덮어쓰기 라우트, 또는 P2로 read-only 다운로드만 우선).
- 언어별 SRT 다운로드 버튼.

### 10.3 신규/수정 컴포넌트

- 신규: `features/editor/components/LanguageTabs.tsx`, `AddLanguageModal.tsx`, `TranslationProgress.tsx`
- 수정: `EditorLayout.tsx`(탭 바/로드), `hooks/useSubtitleStore.ts`(언어 상태)

---

## 11. Implementation Guide

### 11.1 구현 순서(P0→P1)
1. 기반(env·deepl 클라·languages) → 2. 도메인+DB(스키마·service·gating·storage) → 3. 워커(translate·poll-loop) → 4. API → 5. 편집기 UI → 6. 번인 다국어+게이팅 UI

### 11.2 임포트 경계 점검
- `lib/deepl.ts`: 외부 패키지 + `lib/env`만. ✅
- `services/translation/*`: `lib/*`, `types/*`, 다른 service. ✅
- `app/api/translations/*`: `services/translation`, `lib/api`, `lib/supabase/server`만. ✅
- `features/editor/*`: `types/*`, `lib/supabase/browser`, fetch. 서버 인프라 직접 금지. ✅

### 11.3 Session Guide (Module Map) — `/pdca do subtitle-translation --scope module-N`

| 모듈 | 범위 | 신규/수정 파일 | 의존 |
|------|------|----------------|------|
| **module-1** 기반 | DeepL 클라·env·언어설정 | `lib/deepl.ts`(N), `lib/env.ts`(M), `lib/storage.ts`(M: 키함수), `services/translation/languages.ts`(N) | — |
| **module-2** 도메인+DB | 테이블·타입·서비스·게이팅·스토리지서비스 | `supabase/migrations/{ts}_translations.sql`(N), `renders` alter(N), `database.types.ts`(M), `types/translation.ts`(N), `services/translation/{service,gating,index}.ts`(N), `services/storage/*`(M) | module-1 |
| **module-3** 워커 | 번역 처리·폴링 분기·cleanup | `worker/translate.ts`(N), `worker/cli/poll-loop.ts`(M), `worker/index.ts`(M opt) | module-2 |
| **module-4** API | 라우트·스키마 | `app/api/translations/route.ts`(N), `[id]/route.ts`(N), `[id]/stream/route.ts`(N), `[id]/download/route.ts`(N), `app/api/jobs/[jobId]/translations/route.ts`(N), `app/api/translations/schema.ts`(N) | module-2 |
| **module-5** 편집기 UI | 언어 탭·추가모달·진행률·다운로드 | `features/editor/components/{LanguageTabs,AddLanguageModal,TranslationProgress}.tsx`(N), `EditorLayout.tsx`(M), `hooks/useSubtitleStore.ts`(M) | module-4 |
| **module-6** 번인 다국어 | 렌더 언어 선택·게이팅 UI | `worker/render.ts`(M: `loadCuesForLang`), `services/render/service.ts`(M: subtitle_lang), `app/api/renders/schema.ts`(M), `features/editor/.../ExportButton`(M: 언어 드롭다운) | module-3,5 |

**권장 세션 분할**: 세션1 = module-1+2(백엔드 기반), 세션2 = module-3+4(E2E 백엔드 완성→워커로 실번역 검증), 세션3 = module-5, 세션4 = module-6.

---

## 12. 테스트 계획

- **단위(Vitest)**: `deeplTranslate` 배치/429 재시도(모킹), `parseSrt→번역치환→buildSrt` 타임스탬프 보존, `assertTranslationAllowed` 게이팅(무료 1언어/Pro), `languages` 매핑, `cleanupExpiredTranslations`.
- **통합/E2E**: 워커 `processTranslation` — 실제 DeepL 호출(키 있으면)으로 ko→en SRT 생성, 타임스탬프 동일성 검증(앞서 STT E2E와 동일하게 `test-tmp/ko_test.mp4` 산출 SRT 사용 가능).
- **API**: POST 검증·게이팅 403, GET/stream 상태 전이.

---

## 13. 위험 & 완화 (Plan 위험표 + 설계 보강)

| 위험 | 완화 |
|------|------|
| DeepL 무료 50만자/월 초과 | `TRANSLATION_MAX_CHARS_PER_JOB` 잡당 상한 + 무료 잡당 1언어 게이팅 + (P2)월 누적 카운터(system 테이블/heartbeat식) |
| 429 레이트리밋 | 배치(≤50) + 지수백오프 재시도, 동시성 1(워커 순차) |
| 타임스탬프 싱크 | cue.text만 교체, 번역 후 cue 수·index 일치 assert |
| 워커 미가동 | 기존 워커 다운 Discord 알림 재활용 + prod 워커 상시화는 별도 과제 |
| 게이팅 우회 | API+service 이중 검증, 클라 신뢰 금지 |
| DeepL 코드≠내부코드 | `SUPPORTED_LANGUAGES.toDeeplCode` 단일 출처 |
| 가입 시 카드검증(지역) | 키 발급은 사용자 작업으로 명시(Do 전 준비물) |

---

## 14. Do 단계 준비물(사용자)
- DeepL API Free 가입 → API Key 발급 → `.env`에 `DEEPL_API_KEY` 추가(+ 필요 시 `DEEPL_API_URL`).
- prod(Vercel) 환경변수에도 `DEEPL_API_KEY` 추가(번역 워커가 prod 자격으로 돌 경우)는 워커 실행 위치에 따라 결정.
