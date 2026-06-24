---
template: analysis
version: 1.0
feature: subtitle-translation
date: 2026-06-24
phase: check
match_rate: 96
author: gap-detector
---

# 자막 번역(다국어) 갭 분석 (PDCA Check)

## Context Anchor
- **WHY**: 한국어 단일 트랙 한계 → 글로벌 도달. 경쟁사 전부 가진 필수 기능.
- **SUCCESS**: 대상언어 선택 → 번역잡 finished → 언어별 SRT 다운로드 + 번인 렌더 언어선택 E2E, 타임스탬프 100% 보존.

## Match Rate: **96%**
모듈맵 m1~m6 전부 구현 · Success Criteria 6/6 충족 · SCOPE 준수 · 임포트 경계 위반 0 · **Critical 0**.
설계 §13 정책상 보완 1건(Important, 조치 완료) + Minor 4건(설계 허용 대안/의도된 설계).

## 모듈별 충족표

| 모듈 | 범위 | 충족 | 비고 |
|------|------|:----:|------|
| m1 기반 | DeepL 클라·env·언어설정 | ✅ 100% | `deeplTranslate`(배치≤50·429백오프·빈문자스킵·순서보존), env 3종, `translatedSubtitleStorageKey`, `SUPPORTED_LANGUAGES` |
| m2 도메인+DB | 테이블·타입·서비스·게이팅 | ✅ 100% | `translations`(unique idx·RLS), `database.types.ts` Row 미러, 상태전이 전체, gating |
| m3 워커 | 처리·폴링·cleanup | ✅ 100% | `processTranslation`, poll-loop 분기 + cleanup tick |
| m4 API | 라우트·스키마 | ✅ 95% | `[id]/download` 전용 라우트만 없음 — `downloadUrl`(signed)로 동등 충족(설계 허용 대안) |
| m5 편집기 UI | 탭·추가·진행률·다운로드 | ✅ 90% | 탭 통합 대신 read-only 분리 패널(`TranslationsPanel`) — 설계 §10.2 "MVP read-only 우선" 허용 |
| m6 번인 다국어 | 렌더 언어선택 | ✅ 100% | `subtitle_lang` alter, `loadCuesForLang`, ExportButton 드롭다운 |

**Success Criteria 6/6 (100%)**: 언어선택→번역잡→done→언어별 SRT 다운로드→번인 언어선택 E2E 성립. 타임스탬프 보존 확인(`worker/translate.ts` — `cue.text`만 교체, index/startMs/words 유지).

## 갭 목록

### 🟡 Important (1건) — ✅ 조치 완료
- **I-1. 번인 언어 done 서버검증 부재** (confidence 85%) — `createRender`가 `subtitleLang`을 지원언어인지만 검증하고 해당 번역이 `done`인지 미확인. UI는 done만 노출하나 "클라 신뢰 금지"(Design §13) 위반.
  - **조치(커밋 56370c0)**: `hasDoneTranslation(jobId, lang)` 추가 + `createRender`에서 `subtitleLang!=='ko'`면 done 존재 검증 → 없으면 `AppError('INVALID_INPUT')`.

### ⚪ Minor (4건) — 수용/의도된 설계
- **M-1**: 편집기 UI가 `LanguageTabs`/`AddLanguageModal` 통합 대신 read-only 분리 패널. 설계 §10.2가 허용(P2). 기능 손실 없음 → 설계 문서에 구현 노트 추가.
- **M-2**: `[id]/download` 전용 라우트 없음 — signed `downloadUrl`로 동등(설계 명시 대안).
- **M-3**: `translatedSubtitleStorageKey`가 read/write 모두 `now()` yyyy/mm 사용 → 월 경계 키 불일치 가능. 단 원본 `subtitleStorageKey`도 동일 컨벤션, cleanup은 DB 키 사용해 무영향.
- **M-4**: RLS select가 `owner_type='user'`만 — 게스트는 admin+쿠키 검증 경로(Design §3.1 의도).

## 임포트 경계: 위반 0건
`lib/deepl.ts`(env만), `services/translation/*`(admin/api/services/types), `app/api/*`(services 경유). features(`TranslationsPanel`·`ExportButton`)는 zero-dep `services/translation/languages.ts`만 참조 → admin 번들 유출 없음. 금지 4종(admin·storage·redis·resend) 직접 import 0.

## 결론
Match Rate 96% (≥90%) → **Report 단계 진행 가능**. Important I-1 조치 완료. 잔여는 설계 문서 정리(M-1)뿐.
