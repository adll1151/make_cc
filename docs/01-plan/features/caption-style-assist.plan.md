---
template: plan
version: 1.0
feature: caption-style-assist
date: 2026-06-30
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (편집기 어시)
---

# 자막 스타일 어시 Planning Document — Tier 1 (무료·휴리스틱)

> **Summary**: 편집기에서 **이미 가진 데이터(영상 종횡비·자막 CPS·화자 수·길이)** 만으로 어떤 번인 자막 프리셋이 어울리는지 **추천 툴팁 + `✨ 추천 적용` 버튼**을 제공한다. 외부 API·GPU·비용이 전혀 없는 **순수 클라이언트 휴리스틱**으로, 프리셋(`caption-templates`)·CPS(`CueItem`)·화자(`speakerId`) 등 기존 자산을 재활용한다.
>
> **Project**: make_cc · **Date**: 2026-06-30 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 번인 스튜디오에 프리셋 5종(기본·굵은노랑·하단박스·상단·예능)·폰트·색·위치 옵션이 있지만, **타이포 지식이 없는 크리에이터는 "내 영상엔 뭐가 맞는지" 모른다.** 전부 기본값으로 내보내 가독성·임팩트가 떨어진다. |
| **Solution** | 영상·자막을 분석(무료 휴리스틱)해 **상황에 맞는 프리셋을 추천**하고 한 번에 적용. 예: *"세로형 + 말이 빠른 영상 → '굵은 노랑·하단·2줄' 추천"*. |
| **Function/UX Effect** | TemplatePicker 위에 추천 배너 + 근거 칩 + 원클릭 적용. 사용자는 고민 없이 좋은 출발점에서 시작하고, 언제든 오버라이드. |
| **Core Value** | **$0·즉시·온디바이스.** 비전 LLM 없이 80% 체감 가치. 경쟁사(Submagic·Vrew의 자동 스타일) 대비 차별 시작점이며, 추후 Tier 2/3로 확장 가능한 기반. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 스타일 선택 장벽 제거 → 번인 사용률·결과 품질 ↑. 기존 데이터만 쓰므로 비용 0. |
| **WHO** | 타이포에 약한 일반 크리에이터(쇼츠·유튜브·강의). |
| **RISK** | ① 추천이 빗나가면 신뢰 하락 → **제안만·강제 X·오버라이드 항상 가능** ② 휴리스틱 규칙의 근거 빈약 → 규칙을 문서화·테스트로 고정 ③ 종횡비/CPS 측정 실패 시 graceful(추천 숨김). |
| **SUCCESS** | 편집기 진입 시 영상·자막 신호로 프리셋 1개 + 근거 2~3개를 제시하고, `추천 적용`이 `applyTemplate(key)`로 즉시 반영. 신호 부족 시 깔끔히 비표시. 단위테스트로 신호→추천 매핑 고정. |
| **SCOPE** | IN: 클라이언트 휴리스틱 추천(프리셋 + 근거 문구), TemplatePicker UI, 원클릭 적용, 단위테스트. OUT(이연): 프레임 픽셀 분석(Tier 2), 얼굴/안전영역(Tier 2), 비전 LLM 추천(Tier 3), 색/위치 미세 자동조정. |

---

## 목표 / 비목표

**목표 (Tier 1)**
- 편집기에서 **순수 함수** `suggestCaptionStyle(signals) → { presetKey, reasons[] }` 로 프리셋 추천
- 신호: **영상 종횡비**(세로/가로/정사각), **CPS 분포**(중앙값·고CPS 비율), **화자 수**, **영상 길이/자막 밀도**
- TemplatePicker 상단에 **추천 배너 + 근거 칩 + `✨ 추천 적용`** 버튼
- 신호 측정 실패/불충분 시 **비표시**(에러 없이)
- 추천 규칙을 **vitest로 고정**(대표 신호 조합 → 기대 프리셋)

**비목표 (이연)**
- Tier 2: ffmpeg 프레임 샘플 → 밝기/대비/주요 색 → 자막 색·외곽선·안전영역(얼굴 회피) 추천 (가벼운 ML 필요)
- Tier 3: 비전 LLM에 프레임+자막 → 톤·스타일 추천 (잡당 비용 → 수익화 후, [[project-monetization]] 선행)
- 자동 적용(사용자 동의 없이), 폰트/색 자유 미세조정 자동화

---

## 핵심 설계 결정

| 항목 | 결정 | 비고 |
|------|------|------|
| 실행 위치 | **순수 클라이언트** | 비용·지연 0. 서버/워커/큐 불필요 |
| 코드 위치 | `src/features/editor/lib/caption-suggest.ts` (순수 함수) | `caption-templates.ts`와 동일 레이어. import 경계: features → types/lib만 (서버 없음) |
| 입력 신호 | 종횡비·CPS·화자수·길이 | 전부 편집기에 이미 존재 (아래 데이터 출처) |
| 출력 | `{ presetKey, reasons: string[], confidence }` | 프리셋 키는 `CAPTION_TEMPLATES`의 key 그대로 |
| 적용 | `useCaptionStyle.applyTemplate(presetKey)` 재사용 | 기존 store 액션, 추가 상태 불필요 |
| 표시 정책 | 제안만·오버라이드 가능·신호부족시 숨김 | 신뢰 우선 |

### 데이터 출처 (이미 보유 — 신규 수집 없음)

| 신호 | 출처 | 비고 |
|------|------|------|
| 종횡비 | 편집기 `<video>`의 `videoWidth/videoHeight` | 9:16 세로 / 16:9 가로 / 1:1. 로드 후 사용(없으면 추천 보류) |
| CPS | `features/editor/components/CueItem.tsx`의 CPS 계산 로직 → 공용 util로 추출 | cue별 char/sec. 중앙값·>17 비율 |
| 화자 수 | cues의 `speakerId` distinct / `jobs.speakerMap` | 2명+ → 화자 구분 강조 후보 |
| 길이·밀도 | cue 수 / 총 길이 | 짧은 쇼츠 vs 긴 강의 구분 |

---

## 추천 규칙 (초안 — 리뷰/테스트로 확정)

> 규칙은 단순·설명가능하게. 각 추천엔 **사람이 읽는 근거**를 함께 낸다.

| 조건 | 추천 프리셋 | 근거 문구(예) |
|------|------------|----------------|
| 세로(9:16) + 고CPS 비율 높음 | `bold-yellow` (굵은 노랑) | "세로형 + 말이 빠른 영상 → 크고 굵은 자막이 잘 읽혀요" |
| 세로(9:16) + 일반 | `variety` (예능) 또는 `bold-yellow` | "쇼츠/릴스엔 임팩트 있는 자막이 어울려요" |
| 가로(16:9) + 강의/긴 영상 | `basic` (기본) 또는 `top-clean` | "긴 가로 영상엔 깔끔한 자막이 가독성에 유리해요" |
| 화자 2명+ | (현 프리셋 유지) + 안내 | "화자가 여러 명이에요 — 화자 구분 표시를 켜보세요" |
| 배경 복잡 추정(=고CPS·자막 많음 대용지표) | `boxed` (하단 박스) | "자막이 많아요 — 박스 배경이 안정적이에요" |

*주의: Tier 1은 픽셀 분석이 없으므로 "배경 복잡"은 직접 측정 못 함 → CPS·자막밀도를 대용 지표로만 사용. 실제 배경 대비 기반 추천은 Tier 2.*

---

## 모듈맵 (구현 단위)

| 모듈 | 산출물 | 내용 |
|------|--------|------|
| **m1** 신호 추출 | `caption-signals.ts` + CPS util 추출 | `<video>` 종횡비, cues→CPS 분포·화자수·밀도 계산. `CueItem`의 CPS 로직을 공용 util로 분리(중복 제거) |
| **m2** 추천 엔진 | `caption-suggest.ts` (순수) + 테스트 | `suggestCaptionStyle(signals)`. 규칙표 구현 + vitest 대표 케이스 |
| **m3** UI | `CaptionSuggestion.tsx` + TemplatePicker 통합 | 추천 배너·근거 칩·`✨ 추천 적용`. 신호부족 시 null 렌더 |
| **m4** 다듬기 | 문구·접근성·텔레메트리 훅(선택) | 근거 카피 확정, reduced-motion, (선택)추천 채택률 집계 자리 |

권장 진행: m1+m2(로직·테스트) 한 세션 → m3(UI) → m4.

---

## 수용 기준 (Acceptance)

- [ ] 세로/가로/정사각 + 고/저 CPS + 단일/다중화자 대표 6~8 케이스에서 기대 프리셋 반환 (vitest)
- [ ] 편집기에서 영상 로드 후 추천 배너 노출, `추천 적용` → 미리보기 즉시 반영
- [ ] 종횡비·CPS 측정 불가 시 배너 비표시(콘솔 에러 없음)
- [ ] 사용자가 프리셋/커스텀으로 오버라이드 가능(추천이 잠그지 않음)
- [ ] tsc·eslint·vitest·next build 통과

---

## 비목표 재확인 / 다음 단계

- Tier 2(프레임 색·안전영역)·Tier 3(비전 LLM)은 **본 Plan 범위 밖** — 별도 Plan에서.
- 다음: 본 Plan 리뷰 → `/pdca design caption-style-assist` (Design) → m1~m2 구현.
- 연관: 프리셋/스타일은 [[project-libass-poc]]·기존 번인 파이프라인 재활용. 수익화 우선순위는 [[project-monetization]](워커 24/7가 선결, 본 기능은 비용 0이라 병행 가능).
