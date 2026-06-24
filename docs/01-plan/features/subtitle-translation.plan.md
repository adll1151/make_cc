---
template: plan
version: 1.0
feature: subtitle-translation
date: 2026-06-24
author: shong7500
project: make_cc
status: Draft
phase: phase-3
---

# 자막 번역(다국어) Planning Document — phase3

> **Summary**: 완성된 한국어 SRT를 **DeepL**로 다국어 번역해, 한국어 전용이던 서비스를 글로벌 콘텐츠 제작 도구로 확장한다. 번역은 **잡 큐(워커)** 로 처리하고, 편집기에서 **언어 탭 전환·편집**, 언어별 **SRT 다운로드**, 그리고 **번인 렌더의 언어 선택**까지 기존 자산(SRT·editor·render)을 재활용한다.
>
> **Project**: make_cc · **Date**: 2026-06-24 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | STT 결과가 한국어 단일 트랙뿐이라 글로벌 시청자(유튜브·쇼츠 해외 노출)에게 닿지 못한다. 경쟁 서비스(Vrew 100+, Submagic, Veed, Kapwing, Maestra 등)는 사실상 전부 자막 번역을 기본 제공하는데 우리는 부재 — 명확한 기능 공백. |
| **Solution** | 완성된 한국어 SRT를 DeepL로 대상 언어로 번역해 **언어별 자막 트랙**을 생성. 잡 큐로 비동기 처리, 편집기 언어 탭에서 검수·수정, 언어별 SRT 다운로드 + 번인 렌더 언어 선택. 게이팅은 무료 1~2언어 / Pro 무제한(`readIsPro` 재활용). |
| **Function/UX Effect** | "한국어 자막 완성 → 버튼 한 번으로 영·일·중 자막 추가 → 언어별 다운로드/번인". 유튜버가 다국어 자막을 한 곳에서 처리. |
| **Core Value** | **GPU 없이(DeepL API) 도는 확장 기능**으로 "한국어 도구 → 글로벌 도약". 번역 트랙은 STT 재처리 없이 텍스트만 변환하므로 비용·시간 모두 저렴. |

조사 근거: 2026-06-24 경쟁 서비스 기능 서베이(Vrew·Submagic·Veed·Captions.ai·Opus Clip·Vizard·Descript·Kapwing·Maestra). 본 문서 말미 부록.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 한국어 단일 트랙 한계로 글로벌 도달 불가. 경쟁사 전부가 가진 필수 기능을 메워 제품 가치·시장 확장. |
| **WHO** | 해외 시청자를 노리는 유튜버/쇼츠 크리에이터, 글로벌 콘텐츠 제작자. (1차 ICP: K-콘텐츠 → 영·일·중) |
| **RISK** | ① DeepL API 비용·쿼터 관리 ② 번역 품질/타이밍 싱크(원본 cue 타임스탬프 유지) ③ 워커 가동 의존성(번역도 큐 처리라 워커 필요) ④ 게이팅 우회. |
| **SUCCESS** | 한국어 SRT 보유 잡에서 대상 언어 선택→번역 잡 생성→finished→언어별 SRT 다운로드 + 번인 렌더 언어 선택까지 E2E 동작. 원본 타임스탬프 100% 보존. |
| **SCOPE** | IN: DeepL 번역, 언어별 SRT 트랙 저장, 편집기 언어 탭, 언어별 다운로드, 번인 렌더 언어 선택, 게이팅. OUT: AI 더빙/TTS, 음성 번역, 자동 클립, 실시간 번역. |

---

## 목표 / 비목표

**목표 (phase3)**
- 한국어 SRT 보유 잡에 대해 대상 언어를 골라 **번역 잡**을 생성하고, 워커가 DeepL로 번역해 **언어별 SRT 트랙**을 저장
- 편집기에서 **언어 탭 전환** + 번역 자막 검수·수정·재저장
- **언어별 SRT 다운로드**
- **번인 렌더 언어 선택**(기존 렌더 파이프라인 재활용)
- 게이팅: 무료 1~2언어 / Pro 무제한(`readIsPro`)
- 지원 언어 **설정 기반 확장형**(DeepL 지원 범위 내)

**비목표 (이연)**
- AI 더빙/TTS, 음성 자체 번역(텍스트 자막만)
- 자동 클립·세로 리프레임(별도 phase 후보)
- 실시간/스트리밍 번역
- 번역 품질 자동 평가/용어집 고급 관리(MVP는 기본 번역 + 수동 검수)

---

## 핵심 설계 결정 (사용자 확정)

| 항목 | 결정 | 비고 |
|------|------|------|
| 번역 엔진 | **DeepL** | 품질·속도 우수, 지원 언어 ~30개. `lib/deepl.ts` 신규 + `DEEPL_API_KEY` env |
| 실행 방식 | **잡 큐(워커)** | 기존 jobs/renders 큐 패턴 재활용. 번역은 GPU 불필요 → 경량 워커로도 가능(향후 분리 가능) |
| 게이팅 | **무료 1~2언어 / Pro 무제한** | `services/render/gating.ts`의 `readIsPro` 패턴 재활용 |
| 대상 언어 | **설정 기반 확장형** | `SUPPORTED_LANGUAGES` 상수, DeepL 코드 매핑. 초기 노출은 영·일·중 권장 |

> ⚠️ **트레이드오프**: 잡 큐 방식은 "대량·긴 글 안정성"이 장점이나 **워커 가동이 필요**하다. 단, 번역은 GPU가 필요 없으므로 STT GPU 노드와 분리된 저비용 워커(또는 동일 poll-loop)에서 처리 가능 — 설계 시 이를 반영.

---

## 우선순위 로드맵

### 🔴 P0 — 번역 코어 (E2E 최소 동작)

#### P0-1. DeepL 클라이언트 + 환경변수
- `src/lib/deepl.ts`: DeepL API 래퍼(텍스트 배열 번역, source `ko` 고정, target 코드 매핑, 오류·쿼터 처리). `lib/env.ts`에 `DEEPL_API_KEY`(+ free/pro 엔드포인트) Zod 검증 추가.
- 임포트 경계: `lib/*`는 외부 패키지만 — 준수.

#### P0-2. 번역 도메인 + DB 스키마
- **DB**: `subtitle_translations` 테이블(`id`, `job_id` FK, `lang`, `status`(pending→translating→finished/failed), `storage_key`, `error_code`, `created_at`) — append 패턴. 또는 렌더처럼 `translations` 큐 행.
- `services/translation/service.ts`: `createTranslation`(소유검증·finished SRT 확인·게이팅·중복 방지·insert·enqueue), `getTranslation`/`listTranslationsByJob`, 상태 전이 헬퍼.
- **번역 로직**: 원본 SRT 파싱(`lib/srt` 재활용) → cue 텍스트만 DeepL 번역 → **타임스탬프 그대로 유지**하며 재조립 → `subtitles` 버킷에 `{jobId}.{lang}.srt`로 저장.
- 마이그레이션: `supabase/migrations/{ts}_subtitle_translations.sql` + `database.types.ts` 갱신.

#### P0-3. 워커 번역 처리
- `worker/translate.ts`: `processTranslation(translationId)` — 원본 SRT 로드 → DeepL 번역 → 저장 → 상태 finished.
- `worker/cli/poll-loop.ts`: pending 번역 픽업 분기 추가(렌더·STT와 동일 패턴). GPU 불필요.
- `worker/index.ts`: 번역 컨슈머(BullMQ 경로 사용 시).

#### P0-4. API 라우트
- `POST /api/translations`(잡+언어 → 번역 잡 생성, 게이팅 검증), `GET /api/translations/[id]`(상태/다운로드), `GET /api/jobs/[jobId]/translations`(목록), `GET /api/translations/[id]/stream`(SSE 진행, 렌더 stream 미러).
- `schema.ts`(Zod) — 언어 코드 화이트리스트 검증.

### 🟡 P1 — UI 통합

- **P1-1. 편집기 언어 탭**: `features/editor`에 언어 탭(원본 ko + 번역 트랙들) 전환 UI. 탭별 cue 로드/편집/저장. "언어 추가" 버튼 → 대상 언어 선택 모달 → 번역 잡 트리거 + 진행률.
- **P1-2. 언어별 다운로드**: 기존 SRT 다운로드 라우트를 lang 파라미터로 확장 또는 번역 다운로드 라우트 추가.
- **P1-3. 번인 렌더 언어 선택**: `ExportButton`/`CaptionStylePanel`에 언어 드롭다운 → `createRender`에 lang 전달 → 워커가 해당 언어 SRT로 번인. (렌더 파이프라인은 SRT 키만 바꾸면 재활용)

### 🟢 P2 — 다듬기 & 확장
- **P2-1. 게이팅 UI**: 무료 한도 초과 시 Pro 유도 모달(번인 게이팅과 동일 톤).
- **P2-2. 언어 확장**: `SUPPORTED_LANGUAGES`에 스·베·기타 추가. 깃발/네이티브명 표기.
- **P2-3. 용어집(glossary)**: DeepL glossary로 브랜드/고유명사 일관성(후속).
- **P2-4. 비용 가드**: 잡당 문자 수 상한·월 쿼터 카운터(게스트/무료).

---

## 추천 시퀀스
1. **P0-1**(DeepL 클라 + env) — 기반
2. **P0-2**(도메인 + 스키마 + 번역 로직) — 핵심
3. **P0-3**(워커 처리) → **P0-4**(API) — E2E 백엔드 완성
4. **P1-1~P1-2**(언어 탭 + 다운로드) — 사용자 가치 가시화
5. **P1-3**(번인 언어 선택) → **P2**(게이팅 UI·확장·비용 가드)

---

## 검증 항목 사전 확인 (착수 전 코드 대조 필요)
- `services/render/gating.ts`의 `readIsPro` 시그니처/위치 — 번역 게이팅에 재사용 가능한지 확인.
- `lib/srt.ts` 파서/빌더가 cue 텍스트만 교체 후 재조립을 지원하는지(타임스탬프 보존).
- `subtitles` 버킷 키 규칙(`services/storage`의 `plannedSubtitleStorageKey` 등)과 lang 접미사 충돌 여부.
- 렌더 생성(`createRender`)이 자막 SRT 키를 어떻게 받는지 — 언어별 키 주입 지점.
- 게스트 잡에도 번역 허용할지(게이팅: 게스트=무료 정책 일치 확인).
- `job_events`처럼 번역 상태 전이 감사 로그를 둘지(상태 머신 일관성).

---

## 위험 & 완화
| 위험 | 완화 |
|------|------|
| DeepL 비용 급증 | 잡당 문자 상한 + 무료 게이팅(1~2언어) + 월 쿼터 카운터(P2-4) |
| 번역 타이밍 싱크 깨짐 | cue 텍스트만 교체, 타임스탬프·인덱스 원본 유지(번역 후 재파싱 검증) |
| 워커 미가동 시 번역 멈춤 | 워커 다운 Discord 알림(기존) 재활용 + prod 워커 상시화 별도 과제로 명시 |
| 게이팅 우회 | 서버(API+service) 이중 검증, 클라 신뢰 금지 |
| DeepL 언어코드 ≠ 내부코드 | `SUPPORTED_LANGUAGES` 매핑 단일 출처로 관리 |

---

## 부록: 경쟁 서비스 조사 요약 (2026-06-24)
- **자막 번역은 사실상 업계 표준**: Vrew(100+ 언어, XL8·Google 연계), Submagic(번역 자막), Veed, Kapwing(SRT/VTT/TXT + 브랜드 용어집), Maestra(125+·DeepL/OpenAI), ElevenLabs(150+·더빙 연계).
- **포맷**: 대부분 SRT/VTT/TXT 내보내기 + 원본 타임스탬프 유지 + 소스 언어 자동감지.
- **차별 포인트**: 용어집/브랜드 글로서리(Kapwing), 더빙 결합(ElevenLabs) — 우리는 MVP에서 텍스트 번역에 집중, 용어집은 P2.
- **우리 강점 재활용**: 이미 SRT·편집기·번인 렌더 보유 → 번역 트랙만 얹으면 다운로드·편집·번인이 전부 동작. 신규 인프라 최소.
- 출처: vrew.ai/feature/ai-subtitle-translation, submagic.co, hyzenpro.com(Submagic vs Veed vs Captions 2026), kapwing.com/subtitles/translator, maestra.ai/tools/subtitle-translator.
