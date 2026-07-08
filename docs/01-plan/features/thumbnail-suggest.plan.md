---
template: plan
version: 1.0
feature: thumbnail-suggest
date: 2026-07-08
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (편집기 어시)
---

# 섬네일 자동 추출 + 추천 Planning Document

> **Summary**: 업로드된 영상에서 **후보 프레임을 자동 추출**하고, **AI 미학 점수(NIMA) + 얼굴 감지(BlazeFace) + 휴리스틱(선명도·밝기·색감)** 으로 채점해 **베스트 섬네일 1장 + 상위 후보 몇 장**을 추천한다. 크리에이터는 유튜브/쇼츠 **커버로 다운로드**하거나, 선택한 섬네일이 **편집기·히스토리 포스터**로 쓰인다. 전부 **클라이언트 canvas·온디바이스·$0·워커 불필요**로, caption-style-assist의 `frame-sampler`/`frame-analysis` 자산을 재활용한다.
>
> **Project**: make_cc · **Date**: 2026-07-08 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 크리에이터는 자막을 받은 뒤에도 **유튜브/쇼츠 커버 이미지를 따로 만들어야** 한다. 좋은 프레임(선명·인물 정면·자막 안 가림)을 눈으로 스크럽해 고르는 건 번거롭고, make_cc는 지금 섬네일을 전혀 안 준다. 히스토리·편집기 카드도 포스터가 없어 밋밋하다. |
| **Solution** | 영상에서 후보 프레임을 자동 추출 → **AI 미학 점수 + 얼굴 + 휴리스틱**으로 채점 → **베스트 1장 + 후보 그리드**를 제시. 원클릭 다운로드(커버) 및 포스터 지정. 언제든 다른 후보로 오버라이드. |
| **Function/UX Effect** | 편집기에 "섬네일 추천" 패널: 추천 1장 강조 + 후보 4~5장 그리드, 각 근거 칩(⭐미학·😀얼굴·✨선명). 다운로드(PNG/WebP) + "이 컷을 포스터로". |
| **Core Value** | **$0·즉시·온디바이스.** 실재하는 AI(Google NIMA, 브라우저 TF.js/ONNX)로 "그냥 대표 프레임"이 아니라 **보기 좋은** 섬네일 추천. 자막→커버까지 원스톱 = 경쟁사 대비 인접 가치. 워커 의존 0(무료티어 정체성 유지). |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 자막 서비스에 **인접한 부가가치(커버 이미지)** 를 무료·온디바이스로 붙여 체류·완성도↑. 히스토리 포스터로 UI 품질도↑. 워커·비용 의존 없이 free-tier 정체성 유지([[project-monetization]] 무관). |
| **WHO** | 유튜브·쇼츠·강의 크리에이터 — 자막을 받은 뒤 커버까지 필요한 사람. 디자인 툴 없이 좋은 컷을 빠르게 원함. |
| **RISK** | ① 추천이 어색하면 신뢰↓ → **제안만·오버라이드·후보 그리드 항상 제공** ② 브라우저 모델 로드 실패/무거움 → **티어 구조(휴리스틱 필수 + AI 점진 강화)로 graceful** ③ headless/일부 코덱 디코드 한계(memory: H.264 headless 불가) → 실브라우저에선 정상, 실패 시 비표시 ④ 포스터 영속은 이미지 저장 필요 → 얇은 업로드 경로 + thumbnails 버킷. |
| **SUCCESS** | 편집기에서 후보 N장 추출·채점 후 **베스트 1 + 상위 후보**를 근거와 함께 제시, PNG/WebP **다운로드** 동작, 선택 컷을 **포스터로 지정→히스토리 카드 반영**. 모델 로드 실패 시 휴리스틱만으로도 추천 성립. 채점 로직 단위테스트 고정. |
| **SCOPE** | IN: 클라이언트 프레임 추출·채점(휴리스틱+NIMA+얼굴)·추천 UI·다운로드·포스터 지정(+얇은 저장). OUT(이연): OG/공유 미리보기 자동생성, 텍스트/로고 합성(섬네일 에디터), 서버(ffmpeg) 추출, 비전 LLM 캡션형 추천, 자동 A/B 썸네일. |

---

## 목표 / 비목표

**목표**
- 클라이언트에서 후보 프레임 자동 추출(균등 시간 샘플 + 장면 다양성) — `frame-sampler` 재활용/확장
- **채점 티어**:
  - **Tier A (필수·모델無)**: 선명도(Laplacian 분산)·밝기 적정·색감(colorfulness)·무자막영역. `frame-analysis` 재활용. 즉시·$0·항상 동작.
  - **Tier B (AI 점진 강화)**: **NIMA 미학 점수**(MobileNet/AVA, 브라우저 추론) + **BlazeFace 얼굴**(정면·크기·위치). 로드 성공 시 가중 결합, 실패 시 Tier A로 강등.
- **베스트 1장 + 상위 후보 4~5장** 추천 UI(근거 칩 포함)
- **다운로드**(canvas→PNG/WebP blob) — 순수 클라이언트
- **포스터 지정**: 선택 컷을 잡의 대표 이미지로 저장 → 히스토리 카드·편집기 `<video poster>` 반영(얇은 업로드 + `thumbnails` 버킷 + `jobs.thumbnail_path`)
- 채점·추천 매핑을 **vitest로 고정**(대표 프레임 신호 → 기대 순위)

**비목표(이연)**
- OG/공유 페이지 미리보기 이미지 자동 생성(용도 선택에서 제외됨)
- 섬네일 에디터(텍스트·로고·필터 합성)
- 서버/워커 ffmpeg 추출 경로(클라이언트로 충분·워커 의존 회피)
- 비전 LLM 기반 "제목형/감정형" 추천(잡당 비용 → 수익화 후)

---

## 핵심 설계 결정

| 항목 | 결정 | 비고 |
|------|------|------|
| 실행 위치 | **순수 클라이언트(canvas)** | 비용·지연 0, 워커 불필요. 사용자 선택 확정. |
| 프레임 추출 | canvas + `requestVideoFrameCallback` 샘플링 | `frame-sampler.ts` 확장(N개 시점·taint/타임아웃 강등 기존 로직 재사용) |
| 채점 | **티어 A(휴리스틱) + 티어 B(NIMA·BlazeFace)** | 진보적 강화. 로드 실패/저사양 → A만. caption-style-assist Tier1/2 패턴 답습 |
| AI 런타임 | **브라우저 온디바이스**(TF.js 또는 onnxruntime-web) — Design에서 확정 | face-detection은 TF.js 기성 패키지 존재. NIMA는 idealo 변환본 |
| 모델 호스팅 | 가중치 **자체 호스팅**(public/ 또는 버킷) · lazy-load · 캐시 | CDN 미의존. 수 MB(MobileNet) |
| 추천 출력 | `{ best: Candidate, candidates: Candidate[], reasons }` 순수 결과 | 채점 엔진은 순수 함수(테스트 가능) |
| 다운로드 | canvas → `toBlob` PNG/WebP | 서버 불필요 |
| 포스터 영속 | 선택 시에만 업로드(`thumbnails` 버킷 + `jobs.thumbnail_path`) | 다운로드는 저장 불필요, 포스터만 얇은 저장 |
| 표시 정책 | 제안만·오버라이드·신호부족/로드실패 시 graceful | 신뢰 우선 |

---

## 리서치 결과 — "영상 분석 → 섬네일 추천 AI"

사용자 요청("섬네일 나오는 AI 있는지 서치 후 적용")에 따라 조사한 결과:

**결론: 실재하고, 브라우저에서 무료로 돌릴 수 있다.** 채택 스택:

| 신호 | 모델/기법 | 실행 | 출처 |
|------|-----------|------|------|
| **미학 점수** | **NIMA**(Neural Image Assessment, MobileNet·AVA 1~10 분포) | 브라우저 TF.js/ONNX Web(idealo 변환본) | Google Research, idealo |
| **얼굴 존재·정면** | **BlazeFace / MediaPipe Face Detection** | 브라우저 네이티브(TF.js `face-detection`) | Google MediaPipe |
| **선명도·밝기·색감·무자막영역** | 휴리스틱(Laplacian 분산 등) | 순수 canvas 픽셀 | 자체(frame-analysis 선례) |

- 학계 SOTA도 동일 골격: **프레임 균등 샘플 → 미학 점수(선명도·모션·구도·사진품질) → 최고점 선택**. 멀티모달 딥모델(VGG16+ELECTRA+TRILL 등)도 있으나 서버·무겁다 → **이연**.
- 우리 채택 = **NIMA(미학) + BlazeFace(얼굴) + 휴리스틱**을 가중 결합. 전부 온디바이스·무료.

**참고 자료**
- [Introducing NIMA: Neural Image Assessment — Google Research](https://research.google/blog/introducing-nima-neural-image-assessment/)
- [idealo/image-quality-assessment (NIMA MobileNet, TF.js/ONNX 변환)](https://github.com/idealo/image-quality-assessment)
- [Automatic Selection of Beautiful Thumbnails from Videos (arXiv 1609.01388)](https://arxiv.org/pdf/1609.01388)
- [A Multi-modal Deep Learning Model for Video Thumbnail Selection (arXiv 2101.00073)](https://arxiv.org/abs/2101.00073)
- [BlazeFace: Real-time detection in the browser (TF.js)](https://blog.tensorflow.org/2020/03/face-and-hand-tracking-in-browser-with-mediapipe-and-tensorflowjs.html)

---

## 재사용 자산 (신규 인프라 최소화)

| 자산 | 위치 | 재사용 |
|------|------|--------|
| 프레임 샘플러 | `src/features/editor/lib/frame-sampler.ts` | 히든 비디오·crossOrigin·rVFC·taint/타임아웃 강등 로직 그대로 |
| 프레임 분석 | `src/features/editor/lib/frame-analysis.ts` | 밝기·대비·주색·복잡도 휴리스틱 확장 |
| 편집기 영상 | `VideoPlayer.tsx`(crossOrigin=anonymous, Supabase ACAO:*) | canvas taint 없이 프레임 추출 |
| 스토리지 헬퍼 | `src/lib/storage.ts` | 버킷 추가 패턴(videos/subtitles/renders → thumbnails) |
| 잡 상태 | `services/jobs`, `jobs` 테이블 | `thumbnail_path` 컬럼(마이그레이션) |

---

## 사용자 플로우

1. 편집기 진입(영상 로드 완료) → "섬네일 추천" 패널이 백그라운드로 후보 추출·채점 시작(비차단).
2. 베스트 1장 크게 + 후보 4~5장 그리드. 각 근거 칩(⭐8.7 미학 · 😀얼굴 · ✨선명).
3. 사용자 액션:
   - **다운로드**: PNG/WebP 저장(즉시, 서버 불필요).
   - **포스터로 지정**: 선택 컷 업로드 → 히스토리 카드·`<video poster>`에 반영.
4. 모델 로드 실패/저사양 → 휴리스틱 점수만으로 후보 제시(패널은 항상 성립).

---

## 모듈 맵 (Session Guide 초안 — Design에서 확정)

| # | 모듈 | 내용 | 선행 |
|---|------|------|------|
| **m1** | 후보 추출 | `frame-sampler` 확장 → N개 시점 프레임 추출(ImageData/canvas) | — |
| **m2** | Tier A 채점 | 휴리스틱 점수(선명도·밝기·색감·무자막영역) 순수 함수 + 테스트 | m1 |
| **m3** | Tier B AI | NIMA 미학 + BlazeFace 얼굴 로더(lazy·graceful) → 가중 결합 | m2 |
| **m4** | 추천 UI | 섬네일 패널(베스트+후보 그리드·근거 칩·오버라이드) | m2 |
| **m5** | 다운로드 | canvas→blob PNG/WebP | m4 |
| **m6** | 포스터 영속 | thumbnails 버킷·`jobs.thumbnail_path`·업로드 API·히스토리/포스터 반영 | m4 |
| **m7** | QA·정책 | graceful/성능 검증, 실브라우저 육안, 문서 | m3~m6 |

> 권장 세션 분할: **m1+m2**(추출·휴리스틱 = 워커 없이 동작하는 MVP) → **m4+m5**(UI·다운로드) → **m3**(AI 강화) → **m6**(포스터 영속). AI(m3) 없이도 m1·m2·m4·m5로 가치 성립.

---

## 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| 브라우저 모델 로드 지연/실패 | 티어 구조 — Tier A(휴리스틱)로 항상 성립. Tier B는 lazy·비차단·실패 강등 |
| 모델 가중치 용량(수 MB) | lazy-load·HTTP 캐시·1회 로드. 미학 모델은 MobileNet 경량 |
| 코덱/디코드 한계(headless) | 실브라우저 정상. frame-sampler의 taint/타임아웃 강등 재사용. 실패 시 비표시 |
| 추천이 어색 | 제안만·후보 그리드·오버라이드 항상. 채점 규칙 문서화+테스트 고정 |
| 포스터 영속의 스토리지 비용 | 선택 시에만 업로드(수십 KB WebP). 다운로드 경로는 저장 없음 |
| 성능(N프레임 추론) | 후보 수 상한·다운스케일 후 추론·WASM/WebGL 백엔드 |

---

## 수용 기준 (Success Criteria)

1. 편집기에서 후보 프레임 N장을 추출하고 **베스트 1 + 상위 후보**를 근거와 함께 제시한다.
2. 추천 섬네일을 **PNG/WebP로 다운로드**할 수 있다(순수 클라이언트).
3. 선택 컷을 **포스터로 지정**하면 히스토리 카드·편집기 `<video poster>`에 반영된다.
4. **모델 로드 실패 시에도** 휴리스틱만으로 추천이 성립한다(graceful).
5. 채점·순위 로직이 **단위테스트로 고정**된다(대표 신호 조합 → 기대 순위).
6. 신호 부족·디코드 실패 시 에러 없이 **비표시**된다.

---

## 비용

- **추론·추출**: $0(온디바이스). 외부 API·GPU·워커 없음.
- **저장**: 포스터 지정 시에만 수십 KB WebP 1장/잡(무시 가능).

---

## 열린 질문 (Design에서 확정)

1. AI 런타임 = **TF.js** vs **onnxruntime-web** (face-detection 기성 패키지 vs 통일된 ONNX). 번들·용량 트레이드오프.
2. 후보 프레임 수(예: 12~24 샘플 → 상위 5 표시)·샘플 전략(균등 vs 장면전환 감지).
3. NIMA 가중치 소싱/라이선스(AVA·MobileNet 변환본)와 호스팅 위치(public vs 버킷).
4. 포스터 영속 스키마: `jobs.thumbnail_path` 단일 vs 다중 후보 저장.
5. 게스트(비회원) 정책: 다운로드는 허용, 포스터 영속은 회원 한정?

---

## 다음 단계

`/pdca design thumbnail-suggest` — 3가지 아키텍처안(A/B/C) 비교 후 런타임·모듈 경계 확정. Plan의 Context Anchor가 Design으로 전파된다.
