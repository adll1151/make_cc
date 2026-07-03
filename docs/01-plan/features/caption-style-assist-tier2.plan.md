---
template: plan
version: 1.0
feature: caption-style-assist-tier2
date: 2026-07-03
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (편집기 어시)
tier1_ref: docs/01-plan/features/caption-style-assist.plan.md
---

# 자막 스타일 어시 Tier 2 — 프레임 인지형 추천 (Planning)

> **Summary**: Tier 1(종횡비·CPS·화자 = **메타데이터** 휴리스틱)을 넘어, **영상 픽셀 자체**를 브라우저 `<canvas>`로 샘플링해 **자막 영역의 밝기·대비·주색·피사체 위치**를 읽고, 그에 맞춰 **자막 색·외곽선·박스 배경·상/하단 위치를 자동 추천**한다. 여전히 **순수 클라이언트·$0·온디바이스** — 서버·워커·GPU·유료 API 전부 없음. Tier 3(비전 LLM)의 하위 대안으로, 수익화 보류 제약([[project-monetization]]) 하에서도 **바로 만들 수 있는 증분**.
>
> **Project**: make_cc · **Date**: 2026-07-03 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Tier 1은 "세로형+말빠름→굵은 노랑"까지만 안다. **실제 배경이 흰색이면 흰 자막이 안 보이고**, 인물이 화면 하단에 있으면 하단 자막이 얼굴을 가린다. 메타데이터만으론 이걸 알 수 없다. |
| **Solution** | 영상 프레임 6~9장을 canvas로 뽑아 **자막이 놓일 밴드(하단/상단 1/3)의 밝기·대비·주색**과 **피사체가 쏠린 위치**를 계산 → *"배경이 밝아요 → 박스 배경 추천"*, *"하단에 인물이 있어요 → 자막을 위로"* 처럼 **스타일 필드 단위로 보정 제안**. |
| **Function/UX Effect** | Tier 1 배너가 즉시 뜨고(프리셋), 프레임 분석이 끝나면 **점진적으로 근거·보정이 추가**된다(progressive enhancement). `✨ 추천 적용`은 프리셋 + 픽셀 기반 보정을 한 번에 반영. |
| **Core Value** | **여전히 $0·온디바이스.** 비전 LLM 없이 "안 보이는 자막" 문제를 실제로 해결 → 결과 품질 체감 크게 상승. Submagic류 자동 스타일에 한 발 더 근접하면서 비용 0 유지. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Tier 1은 배경을 못 봐서 "흰 배경에 흰 자막", "얼굴 가리는 자막"을 못 막는다. 픽셀을 보면 실제 가독성 문제를 잡을 수 있고, 비용은 canvas라 0. |
| **WHO** | Tier 1과 동일 — 타이포에 약한 일반 크리에이터. 특히 **밝은/복잡한 배경**(야외·화이트보드·밝은 스튜디오) 영상에서 효과 큼. |
| **RISK** | ① **Canvas CORS taint** — Supabase signed URL은 cross-origin이라 `getImageData`가 SecurityError. → 전용 `crossOrigin=anonymous` 히든 비디오 + Storage CORS 설정 + **실패 시 Tier 1로 무해하게 강등**. ② 재생 비디오를 seek하면 끊김 → **별도 히든 비디오로 격리**(재생 영상 불변). ③ 프레임 분석 오추정 → 제안만·오버라이드·근거 명시. ④ 모바일 메모리/성능 → 초소형 캔버스(≤160px)·프레임 수 축소·타임아웃. |
| **SUCCESS** | 편집기에서 Tier 1 배너가 즉시 뜬 뒤, 프레임 분석이 완료되면 밝기/피사체 기반 보정(예: `box:true` 또는 `position:'top'`)이 근거와 함께 추가되고, `추천 적용`이 프리셋+보정을 함께 반영. CORS 불가/분석 실패 시 콘솔 에러 없이 Tier 1만 표시. 순수 분석 함수는 vitest로 고정. |
| **SCOPE** | IN: 클라이언트 프레임 샘플링(canvas), 자막 밴드 밝기·대비·주색·피사체쏠림 분석, 스타일 필드 보정 추천, progressive UI, graceful degradation, 단위테스트, Storage CORS 설정. OUT(이연): 실제 얼굴/객체 검출·ML saliency, 씬 의미 이해, 비전 LLM 톤/무드 추천(Tier 3), 자동 적용(동의 없이). |

---

## 목표 / 비목표

**목표 (Tier 2)**
- 순수 함수 `analyzeFrameRegion(imageData, band) → RegionStats`(밝기·대비·주색·디테일밀도) + 집계 `aggregateFrameSignals(stats[]) → FrameSignals`
- `frame-sampler.ts`: 영상 URL → 프레임 N장 샘플(CORS-safe 히든 비디오, seek, 초소형 canvas, 타임아웃, teardown, 실패 시 null)
- Tier 1 `suggestCaptionStyle(signals, frameSignals?)` 확장 — `frameSignals` 있으면 **스타일 필드 보정(`stylePatch: Partial<CaptionStyle>`) + 보정 근거** 추가, 없으면 Tier 1 동작 그대로(하위호환)
- `CaptionSuggestion.tsx` progressive enhancement + `추천 적용`이 `applyTemplate` 후 `patchStyle(stylePatch)`
- 분석 함수 vitest 고정(어두운/밝은/복잡/피사체쏠림 합성 프레임 → 기대 보정)
- Storage `videos` 버킷 CORS 설정(앱 오리진 GET 허용) — prod 준비물

**비목표 (Tier 3 이연)**
- 진짜 얼굴/객체 검출, ML 기반 saliency, 씬 의미 분석
- 비전 LLM(프레임+자막 → 톤/무드/브랜드 스타일) — 잡당 비용 → [[project-monetization]] 선행
- 서버/워커 프레임 추출(ffmpeg) — 클라이언트 canvas로 충분하고 $0이므로 불필요

---

## 핵심 설계 결정 (요약 — 상세는 Design)

| 항목 | 결정 | 비고 |
|------|------|------|
| 실행 위치 | **순수 클라이언트(canvas)** | 서버/워커/GPU/유료 API 0. Tier 1 철학 유지 |
| 프레임 소스 | **전용 히든 `<video crossOrigin=anonymous>`** | 재생 영상과 격리(seek 끊김·CORS 리스크 차단) |
| CORS | 히든 비디오 anonymous + Supabase Storage CORS(GET) | signed URL은 무자격 → anonymous 가능. 실패 시 Tier 1 강등 |
| 분석 대상 | 자막 밴드(하단/상단 1/3)의 밝기·대비·주색 + 상/하단 디테일밀도(피사체쏠림 프록시) | 초소형 canvas(≤160px)에서 계산 |
| 출력 | Tier1 `{presetKey, reasons, hint, confidence}` + `stylePatch?, patchReasons?` | 필드 단위 보정 |
| 적용 | `applyTemplate(presetKey)` → `patchStyle(stylePatch)` | 기존 store 액션 재사용 |
| 강등 | 분석 불가(CORS/디코드/타임아웃) 시 Tier 1만, 무해 | 신뢰·안정 우선 |

---

## 보정 규칙 (초안 — 리뷰/테스트로 확정)

| 프레임 신호 | 스타일 보정 | 근거 문구(예) |
|------|------------|----------------|
| 자막 밴드 평균 밝기 높음(밝은 배경) + 흰 자막 | `box: true` 또는 어두운 외곽선 강화 | "배경이 밝아요 — 박스 배경이 자막을 또렷하게 해요" |
| 자막 밴드 대비/디테일 높음(복잡한 배경) | `box: true` | "배경이 복잡해요 — 박스 배경이 안정적이에요" |
| 자막 밴드 어두움(어두운 배경) | (기본 유지) 흰 자막 + 외곽선 | "배경이 어두워 흰 자막이 잘 보여요" (확신↑) |
| 하단 디테일밀도 ≫ 상단(피사체 하단쏠림) | `position: 'top'` | "화면 아래쪽에 인물이 있어요 — 자막을 위로 올리면 가려지지 않아요" |
| 상단 디테일밀도 ≫ 하단 | `position: 'bottom'`(유지·확신↑) | "위쪽에 피사체가 있어요 — 하단 자막이 안전해요" |
| 밴드 주색이 자막색과 유사(저대비 위험) | `box: true` 또는 색 대비 경고 | "자막색과 배경색이 비슷해요 — 박스를 켜보세요" |

*주의: "피사체"는 얼굴 검출이 아니라 **국소 대비(디테일)밀도**의 상/하단 분포로 추정하는 프록시. 정밀 검출은 Tier 3.*

---

## 모듈맵 (구현 단위)

| 모듈 | 산출물 | 내용 |
|------|--------|------|
| **m1** 분석 엔진 | `frame-analysis.ts`(순수) + 테스트 | `analyzeFrameRegion`/`aggregateFrameSignals`. 합성 ImageData로 vitest 고정 |
| **m2** 샘플러 | `frame-sampler.ts` | URL→히든 비디오(anonymous)→seek N점→초소형 canvas→`getImageData`→RegionStats. 타임아웃·teardown·실패 null |
| **m3** 추천 융합 | `caption-suggest.ts` 확장 + 테스트 | `frameSignals?` 인자 추가 → `stylePatch`+`patchReasons`. 하위호환 |
| **m4** UI + CORS | `CaptionSuggestion.tsx` 수정 + Storage CORS | progressive enhancement, 결합 적용, prod `videos` 버킷 CORS 설정·검증 |

권장 진행: m1+m2(엔진·샘플러) 한 세션 → m3(융합·테스트) → m4(UI·CORS·검증).

---

## 수용 기준 (Acceptance)

- [ ] 합성 프레임(어두움/밝음/복잡/하단쏠림/저대비) → 기대 `stylePatch`(box/position/외곽선) 반환 (vitest)
- [ ] 동일 오리진 데모 영상(`/editor/sample`, `/samples/demo.mp4`)에서 프레임 샘플→보정 표시, 에러 없음
- [ ] CORS 미설정 cross-origin(실잡 signed URL) → Tier 2 무해 강등, Tier 1 유지, **재생 영향 없음**, 콘솔 에러 없음
- [ ] `추천 적용` → 프리셋 + 픽셀 보정이 미리보기에 즉시 반영, 이후 사용자 오버라이드 가능
- [ ] 모바일/저사양에서 타임아웃 내 완료 또는 무해 강등
- [ ] tsc·eslint·vitest·next build 통과

---

## 다음 단계

- 본 Plan 리뷰 → Design(`docs/02-design/features/caption-style-assist-tier2.design.md`, 작성 완료) → m1~m2 구현.
- Tier 3(비전 LLM)은 범위 밖 — 수익화([[project-monetization]]) 선행 후 별도 Plan.
- 연관: Tier 1 [[caption-style-assist.plan]], 번인 파이프라인 [[project-libass-poc]].
