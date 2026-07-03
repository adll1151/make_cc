---
template: design
version: 1.0
feature: caption-style-assist-tier2
date: 2026-07-03
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (편집기 어시)
architecture: Client-only (canvas, no server)
plan_ref: docs/01-plan/features/caption-style-assist-tier2.plan.md
tier1_ref: docs/01-plan/features/caption-style-assist.plan.md
---

# 자막 스타일 어시 Tier 2 — 프레임 인지형 추천 Design

> **Architecture**: **순수 클라이언트**. 서버·워커·큐·GPU·유료 API **없음**. 브라우저 `<canvas>`가 영상 프레임을 읽어 자막 영역의 픽셀 통계를 계산하고, Tier 1 추천에 **스타일 필드 보정**을 더한다.
> **철학 유지**: $0 · 온디바이스 · 제안만(오버라이드 가능) · 신호 부족/실패 시 무해 강등.

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Tier 1(메타데이터 휴리스틱)은 배경 픽셀을 몰라 "밝은 배경의 흰 자막", "인물을 가리는 하단 자막"을 못 막는다. 픽셀을 canvas로 읽으면 비용 0으로 실제 가독성 문제를 잡는다. |
| **WHO** | 타이포 약한 크리에이터 — 특히 밝은/복잡한 배경 영상. |
| **RISK** | ① Canvas CORS taint(가장 큼) ② 재생 영상 seek 끊김 ③ 오추정 ④ 모바일 성능. (완화는 §7) |
| **SUCCESS** | Tier 1 배너 즉시 → 프레임 분석 완료 시 밝기/피사체 기반 보정 추가 → `추천 적용`이 프리셋+보정 동시 반영. 실패 시 Tier 1만, 무해. |
| **SCOPE** | IN: 프레임 샘플링, 자막밴드 밝기·대비·주색·피사체쏠림 분석, 스타일 필드 보정, progressive UI, graceful degrade, 단위테스트, Storage CORS. OUT: 얼굴/객체 검출·ML saliency·비전 LLM(Tier 3). |

---

## 1. Overview

Tier 1은 `extractCaptionSignals(cues, speakerMap, videoDims)` → `suggestCaptionStyle(signals)`로 **프리셋 1개**를 추천한다(순수 클라이언트 휴리스틱, 이미 구현·배포됨).

Tier 2는 여기에 **픽셀 신호**를 더한다:

```
편집기 로드
  ├─(즉시) Tier 1: 메타데이터 → suggestCaptionStyle(signals)         → 프리셋 배너
  └─(비동기) Tier 2: frame-sampler → frame-analysis → FrameSignals
             → suggestCaptionStyle(signals, frameSignals)            → 프리셋 + stylePatch(색/박스/위치)
```

핵심은 **progressive enhancement**: Tier 1 배너가 먼저 뜨고, 프레임 분석(수백 ms~1s)이 끝나면 같은 배너에 **보정 근거·필드 패치**가 덧붙는다. 분석이 실패하거나 CORS가 막히면 배너는 Tier 1 상태 그대로 남는다(사용자는 아무 이상 없음).

**클라이언트-only 근거**: 프레임 픽셀 통계는 canvas로 충분하고 비용이 0이다. 워커 ffmpeg 프레임 추출은 인프라·비용을 늘리는데, 수익화 보류([[project-monetization]]) 하에서는 부적절. Tier 1과 같은 레이어(`features/editor/lib`, 서버 import 경계 안)에 순수 함수로 얹어 일관성을 유지한다.

---

## 2. 핵심 결정 요약

| # | 결정 | 근거 | 대안(기각) |
|---|------|------|-----------|
| D1 | 프레임 추출 = **브라우저 canvas** | $0·온디바이스, Tier 1 철학 유지 | 워커 ffmpeg(인프라·비용↑, 비동기 왕복) |
| D2 | **전용 히든 `<video crossOrigin=anonymous>`** 로 샘플 | 재생 영상 seek 끊김 방지 + CORS 격리 | 재생 비디오 재사용(끊김·crossOrigin 변경 시 재로드) |
| D3 | 출력 = Tier1 결과 + `stylePatch: Partial<CaptionStyle>` | 프리셋 위에 필드 보정을 얹어 세밀화 | 새 프리셋 다수 추가(조합 폭발) |
| D4 | 적용 = `applyTemplate` → `patchStyle(stylePatch)` | 기존 store 액션 재사용, `template:'custom'` 자연 전이 | store 신규 액션(불필요) |
| D5 | 분석 실패/CORS/타임아웃 → **Tier 1 강등**, 무해 | 신뢰·안정 우선(제안 기능) | 에러 표시(신뢰 하락) |
| D6 | "피사체 위치" = **국소 대비(디테일)밀도**의 상/하단 분포 | 얼굴검출 없이 $0 프록시 | 얼굴검출 라이브러리(무게·Tier 3) |
| D7 | 초소형 canvas(≤160px 폭) · 프레임 6~9장 · 전체 타임아웃(≈4s) | 모바일 성능·체감 지연 최소 | 원본 해상도 샘플(느림·메모리) |

---

## 3. 데이터 모델 (타입)

DB 변경 **없음**(전부 런타임). `features/editor/lib`에 타입 추가.

```ts
// frame-analysis.ts
export type CaptionBand = 'top' | 'bottom';

/** 한 프레임의 자막 밴드 + 상/하단 디테일 통계 (순수 계산). */
export interface RegionStats {
  /** 자막 밴드 평균 밝기 0~1 (perceptual luma) */
  bandLuma: number;
  /** 자막 밴드 밝기 표준편차 0~1 (대비/복잡도) */
  bandContrast: number;
  /** 자막 밴드 대표색 #RRGGBB (coarse 히스토그램 최빈 버킷) */
  bandDominant: string;
  /** 상단 1/3 디테일밀도(국소 대비 합) 0~1 */
  topDetail: number;
  /** 하단 1/3 디테일밀도 0~1 */
  bottomDetail: number;
}

/** 여러 프레임 집계 → 추천에 쓰는 안정 신호. */
export interface FrameSignals {
  sampleCount: number;
  band: CaptionBand;            // 현재 자막 위치 기준 분석 밴드
  bandLuma: number;            // 프레임 평균
  bandContrast: number;
  bandDominant: string;
  brightBandRatio: number;      // bandLuma>0.65 프레임 비율
  busyBandRatio: number;        // bandContrast>임계 프레임 비율
  bottomHeavyRatio: number;     // bottomDetail>topDetail 프레임 비율
  topHeavyRatio: number;
}
```

Tier 1 `CaptionSuggestion` 확장(하위호환, 필드 추가만):

```ts
export interface CaptionSuggestion {
  presetKey: string;
  presetLabel: string;
  reasons: string[];
  hint?: string;
  confidence: 'low' | 'medium' | 'high';
  // Tier 2 (frameSignals 있을 때만 채움)
  stylePatch?: Partial<CaptionStyle>;   // 예: { box: true } 또는 { position: 'top' }
  patchReasons?: string[];
}
```

---

## 4. 모듈 상세

### 4.1 `frame-analysis.ts` (순수 — m1)
- `analyzeFrameRegion(image: ImageData, band: CaptionBand): RegionStats`
  - perceptual luma `0.2126R + 0.7152G + 0.0722B`(0~1)
  - 밴드 = band에 따라 하단/상단 세로 1/3 픽셀만 집계
  - `bandContrast` = 밴드 luma 표준편차
  - `bandDominant` = RGB 각 채널 4~5비트로 양자화한 히스토그램 최빈값 → #RRGGBB
  - `topDetail`/`bottomDetail` = 각 1/3 영역에서 인접 픽셀 luma 차 절대값 합(국소 대비)을 0~1 정규화
- `aggregateFrameSignals(stats: RegionStats[], band): FrameSignals`
  - 평균·비율 집계. `stats.length===0` → null 반환(호출부에서 Tier 1 강등)
- **완전 순수** → 손으로 만든 ImageData로 vitest 고정.

### 4.2 `frame-sampler.ts` (DOM — m2)
```ts
export interface SampleOptions {
  count?: number;         // 기본 8
  maxWidth?: number;      // 캔버스 다운스케일 폭, 기본 160
  timeoutMs?: number;     // 전체 예산, 기본 4000
  band: CaptionBand;      // 현재 자막 위치
  signal?: AbortSignal;
}
export async function sampleFrameSignals(
  videoUrl: string, opts: SampleOptions,
): Promise<FrameSignals | null>;
```
- 히든 `<video>` 생성: `crossOrigin='anonymous'`, `muted`, `preload='auto'`, `playsInline`, `src=videoUrl`. **DOM에 붙이지 않음**(offscreen). 재생 영상과 완전 분리.
- `loadedmetadata` 대기 → duration으로 N개 시점(양 끝 5%~95% 균등) 계산.
- 각 시점: `currentTime=t` → `seeked` 대기 → 초소형 `<canvas>`(maxWidth×비율)에 `drawImage` → `getImageData` → `analyzeFrameRegion`.
- **CORS taint 방어**: `getImageData`를 try/catch. `SecurityError`(taint) 시 즉시 전체 중단 → `null` 반환(Tier 1 강등). 첫 프레임에서 걸러짐.
- 타임아웃/`error`/`abort`/디코드 실패 → `null`. `finally`에서 `src=''`·리스너 해제·엘리먼트 폐기(메모리 누수 방지).
- 성공: `aggregateFrameSignals(stats, band)` 반환.

### 4.3 `caption-suggest.ts` 확장 (순수 — m3)
```ts
export function suggestCaptionStyle(
  signals: CaptionSignals,
  frameSignals?: FrameSignals | null,   // 추가(옵션)
): CaptionSuggestion | null;
```
- `frameSignals` 없으면 **현재 Tier 1 동작 그대로**(하위호환).
- 있으면 Tier 1 프리셋 선택 후 `stylePatch`/`patchReasons` 계산(§보정 규칙, Plan 표):
  - `brightBandRatio` 높음 → `box:true` + "배경이 밝아요…"
  - `busyBandRatio` 높음 → `box:true` + "배경이 복잡해요…"
  - `bottomHeavyRatio` 높고 현재 position=bottom → `position:'top'` + "아래쪽 인물…"
  - `topHeavyRatio` 높음 → position bottom 유지, confidence↑
  - `bandDominant`가 `style.color`와 저대비(간단 luma 차 임계) → `box:true` + "자막색과 배경이 비슷…"
  - 이미 프리셋이 `box`거나 top이면 중복 패치 생략.
- `stylePatch`가 비면(보정 없음) 필드 자체를 넣지 않음(Tier 1 결과 동일).

### 4.4 `CaptionSuggestion.tsx` 수정 (UI — m4)
- 기존: `dims` effect + `suggestCaptionStyle(extractCaptionSignals(...))`.
- 추가:
  - `frameSignals` state + `sampling` state.
  - `videoUrl`은 이미 `EditorLayout`이 보유(`src={videoUrl}`) → prop 또는 store로 전달(현재 `document.querySelector('video')`로 dims 읽는 패턴과 정합 위해 **prop 전달 권장**).
  - effect: `dims`가 잡히고 `cues.length>0`이면 `AbortController`로 `sampleFrameSignals(videoUrl, {band: currentPosition→'bottom'|'top', ...})` 호출 → 성공 시 `setFrameSignals`.
  - `suggestion = suggestCaptionStyle(signals, frameSignals)` (frameSignals null이면 Tier 1).
  - `추천 적용` 핸들러: `applyTemplate(presetKey)` 후 `stylePatch` 있으면 `patchStyle(stylePatch)`.
  - `patchReasons`는 기존 `reasons` 리스트에 이어서 렌더(별도 아이콘/색으로 "픽셀 기반" 구분 가능).
  - 분석 중엔 배너에 미세 로딩 표시(선택). 실패/미측정이면 Tier 1 그대로.

---

## 5. 시퀀스

```
편집기 마운트
 → CaptionSuggestion: video dims 읽기(loadedmetadata)
 → Tier1 배너 렌더(프리셋 + reasons)                         [즉시]
 → sampleFrameSignals(videoUrl, band)
      → 히든 video(anonymous) load → seek×N → canvas → getImageData
      → CORS taint? ── yes ─→ null ─→ 배너 Tier1 유지(무해)
                    └─ no ──→ analyze×N → aggregate → FrameSignals
 → suggestCaptionStyle(signals, FrameSignals)
 → 배너에 patchReasons + stylePatch 힌트 추가                  [수백 ms~1s 뒤]
 → 사용자 "추천 적용" → applyTemplate → patchStyle(stylePatch) → 미리보기 반영
```

---

## 6. CORS 처리 (핵심 리스크)

- **문제**: 실잡 영상은 Supabase Storage **signed URL**(별도 오리진). 그 영상을 canvas에 그리고 `getImageData` 호출 시 캔버스가 **taint**되어 `SecurityError`.
- **해결**:
  1. 히든 비디오에 `crossOrigin='anonymous'`(signed URL은 쿠키/자격 불필요 → anonymous 가능).
  2. Supabase Storage `videos` 버킷에 **CORS 허용**(앱 오리진 `https://makecc.vercel.app` + `http://localhost:3000`에 대해 GET, 또는 `*`). Storage 응답에 `Access-Control-Allow-Origin` 포함되어야 taint 해제.
- **강등**: CORS 미설정/불일치여도 **`getImageData` try/catch → null → Tier 1 유지**. **재생 영상은 crossOrigin 없이 그대로**라 재생엔 전혀 영향 없음. 즉 CORS 설정 전에도 **안전하게 배포 가능**(동일 오리진 데모에선 Tier 2 동작, 실잡은 CORS 설정 후 활성).
- **검증**: `/editor/sample`(`/samples/demo.mp4`=동일 오리진)에서 Tier 2 즉시 동작 → 실잡은 버킷 CORS 설정 후 prod에서 확인.

---

## 7. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| Canvas CORS taint | 전용 anonymous 히든 비디오 + Storage CORS + try/catch 강등(§6) |
| 재생 영상 seek 끊김 | 별도 offscreen 히든 비디오로 격리(D2) — 재생 영상 불변 |
| 오추정으로 신뢰 하락 | 제안만·오버라이드·근거 명시. 저대비/모호 시 patch 생략 |
| 모바일 메모리/성능 | canvas ≤160px, 프레임 6~9장, 전체 타임아웃 4s, 실패 시 강등 |
| seek 이벤트 미발생(일부 코덱) | 시점별 `seeked` 타임아웃 → 해당 프레임 skip, 부족하면 강등 |
| 짧은 영상/단일 프레임 | count를 duration에 맞춰 축소, 최소 1장이라도 있으면 집계 |

---

## 8. 테스트 계획

- **m1 `frame-analysis` (순수, 핵심 커버리지)**: 합성 ImageData로
  - 어두운 밴드 → `bandLuma` 낮음, box 미유발
  - 밝은 밴드 → `brightBandRatio` 높음 → box 유발
  - 상/하 절반 다른 디테일 → `bottomHeavyRatio`/`topHeavyRatio` 정확
  - dominant color 양자화 정확
- **m3 `caption-suggest`**: `FrameSignals` 픽스처 → 기대 `stylePatch`(box/position) + patchReasons. `frameSignals` 없을 때 Tier 1 회귀 동일.
- **m2 `frame-sampler`**: DOM 의존 → 순수 오케스트레이션(시점 계산·집계 경로)만 단위테스트, 실제 seek/taint는 수동·E2E(데모 영상).
- **E2E(수동)**: `/editor/sample` 밝은/어두운 데모로 배너 보정 확인 → CORS 설정 후 실잡 검증.
- 게이트: tsc·eslint·vitest·next build.

---

## 9. 롤아웃

1. m1~m4 구현·테스트 → 배포. ✅ 완료(커밋 8aae868).
2. ~~Supabase `videos` 버킷 CORS 설정~~ → **불필요 확인(2026-07-03 실측)**: Supabase Storage signed URL은 이미 `Access-Control-Allow-Origin: *`를 반환한다(REST 프로브: 임시객체 업로드→sign→Origin GET→ACAO=`*`). → `crossOrigin='anonymous'`로 canvas taint 없이 **실잡에서 즉시 동작**. 별도 버킷 CORS 구성 단계 없음.
3. prod 검증(밝은 배경 실영상 업로드 → 박스/위치 보정 관찰).

> **참고**: §6·§10.7의 graceful degrade(load error/taint→null)는 방어선으로 유지. Supabase가 ACAO를 계속 제공하는 한 실잡 Tier 2는 활성.

- **비목표 재확인**: 얼굴/객체 검출·ML saliency·비전 LLM(Tier 3)은 범위 밖 — [[project-monetization]] 선행 후 별도 Plan.

---

## 10. 검증 반영 (Design v1.1 — design-validator 2026-07-03)

검증에서 나온 🔴/🟡/🟢을 아래로 확정한다. 구현은 본 절을 우선한다.

### 10.1 명명 상수 (테스트 결정론화 — 🔴 해소)
`frame-analysis.ts`에 상수로 고정. luma·contrast·detail은 전부 **0~1**.

| 상수 | 값 | 의미/근거 |
|------|-----|-----------|
| `BRIGHT_LUMA` | 0.65 | 밴드 평균 luma가 이 위면 "밝은 배경" |
| `BRIGHT_BAND_RATIO_MIN` | 0.5 | 프레임 절반↑이 밝으면 box 보정 |
| `BUSY_CONTRAST` | 0.22 | 밴드 luma 표준편차가 이 위면 "복잡한 배경" |
| `BUSY_BAND_RATIO_MIN` | 0.5 | 프레임 절반↑이 복잡하면 box 보정 |
| `DETAIL_DOMINANCE` | 1.3 | 한쪽 디테일이 반대편의 1.3배↑여야 "쏠림"으로 카운트 |
| `DETAIL_HEAVY_RATIO_MIN` | 0.6 | 프레임 60%↑에서 하단쏠림이면 position 보정 |
| `LOWCONTRAST_LUMA_DIFF` | 0.25 | \|밴드 luma − 자막색 luma\| 가 이 아래면 저대비 위험 |

**정규화 기준(명시)**: `topDetail`/`bottomDetail` = 해당 1/3 영역에서 **가로 인접 픽셀 luma 차 절대값의 평균**. luma·차 모두 [0,1]이라 평균도 [0,1] (별도 max 정규화 불필요). `bandContrast` = 밴드 luma 표준편차(모집단). luma = `0.2126R+0.7152G+0.0722B` (R/G/B는 0~1).

### 10.2 저대비 규칙의 색 출처 (🟡 해소 — 3번째 인자 불필요)
`suggestCaptionStyle(signals, frameSignals?)` 내부에서 **추천 프리셋의 색**을 쓴다: `getTemplate(presetKey).style.color`의 luma와 `frameSignals.bandLuma` 비교. store의 현재 CaptionStyle을 넘길 필요 없음(시그니처 2인자 유지). 밝은배경 규칙과 겹치면 근거·패치 중복 제거.

### 10.3 `position:'middle'` → 밴드 매핑 (🟡 해소)
분석 밴드는 `'top'|'bottom'`뿐. 현재 스타일 position이 `'middle'`이면 **`'bottom'`으로 샘플**(대다수 자막 하단). 문서·코드에 주석 명시.

### 10.4 적용 상태 UI (🟡 해소)
`patchStyle`가 `template:'custom'`으로 바꾸므로 `currentTemplate === presetKey`로는 "적용됨"이 안 잡힌다. → 컴포넌트에 **`appliedRef`(로컬 boolean state)** 를 두어 "추천 적용" 클릭 시 true, 사용자가 프리셋/커스텀 바꾸면 리셋. `stylePatch` 유무와 무관하게 이 플래그로 버튼 라벨 결정.

### 10.5 모바일 디코드 + 프레임 확정 (🟡 해소)
- **offscreen 비디오는 iOS Safari에서 canvas 페인트 거부** 가능 → 히든 비디오를 **visually-hidden(화면 밖 1px, `position:fixed;opacity:0`)으로 DOM에 부착** + `muted`로 짧게 `play()` 시도 후 seek. 그래도 실패하면 → null 강등(무해).
- **`seeked` ≠ 프레임 그려짐** → 가능하면 `video.requestVideoFrameCallback`로 페인트 확정 후 `drawImage`. 미지원 브라우저는 `seeked` + 짧은 rAF 폴백. 시점별 `PER_SEEK_TIMEOUT_MS=1200` 초과 시 해당 프레임 skip.

### 10.6 재샘플 방지 (🟡 해소)
`CaptionSuggestion` 샘플링 effect는 **`cues` 의존 금지**(키 입력마다 재발화). 키 = **`(videoUrl, band)`** 1회만. Tier 1 신호(`suggestCaptionStyle`의 1인자)는 계속 `cues`로 갱신하되, 프레임 신호는 별도 state로 고정.

### 10.7 CORS 정정 (🟢)
`crossOrigin='anonymous'` 설정 시, cross-origin 응답에 `Access-Control-Allow-Origin`이 **없으면 미디어 load 자체가 실패(`error` 이벤트)** — taint 후 `getImageData`가 아니라 로드 단계에서 걸린다. → **`error` 핸들러와 `getImageData` try/catch를 둘 다 null로** 배선. `crossOrigin`은 **반드시 `src` 할당 전에** 설정(이후 설정은 재로드/무음 taint 유발).

### 10.8 상수/스코프 정리 (🟢)
- ~~**외곽선 자동조정 이연**~~ → **Tier 2.1 구현 완료(2026-07-03)**: 박스를 쓰지 않지만 배경이 어느 정도 복잡한 구간(`busyBandRatio` ∈ [`MILD_BUSY_RATIO_MIN`=0.3, `BUSY_BAND_RATIO_MIN`=0.5))에서 `outlineWidth`를 `OUTLINE_STRONG`=3.5로 강화(박스보다 가벼운 보정). 이미 박스가 적용되거나 프리셋 외곽선이 이미 굵으면(≥3.5) 생략. 근거: "배경이 약간 복잡해요 — 외곽선을 굵게 하면 자막이 또렷해져요".
- **테스트 추가**: `aggregateFrameSignals([])===null` 제로샘플 회귀 케이스 §8에 포함.
- 샘플러 상수: `SAMPLE_COUNT=8`, `MAX_WIDTH=160`, `TIMEOUT_MS=4000`, `PER_SEEK_TIMEOUT_MS=1200`.
