---
template: plan
version: 1.0
feature: cc-rich-tagging
date: 2026-07-03
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (워커 STT 파이프라인 + 편집기)
ref: docs/marketing/distribution-plan.md, https://wikidocs.net/343561 (2026 한국어 STT 파이프라인 분석)
---

# 리치 CC(오디오 이벤트 태깅) + Whisper Turbo — Planning

> **Summary**: 우리 서비스의 정체성인 **CC(Closed Caption)** 를 이름값에 맞게 완성한다. 지금은 "말"만 전사하지만, **비음성 오디오 이벤트([음악]·[박수]·[웃음]·[기침] 등)를 감지해 표준 CC 관례대로 자막에 삽입**한다(청각장애인 접근성 = CC의 본래 목적). 감지는 **SenseVoice-Small**(NAR·초저지연·다국어·오디오이벤트 내장)로 수행하고, 전사 본문은 검증된 **Whisper**를 유지한다. 동시에 Whisper 모델을 **large-v3 → large-v3-turbo**로 교체해 **VRAM ~40%↓·속도 ~2배↑**로 확보한 여유에 SenseVoice를 같은 GPU에 얹는다.
>
> **Project**: make_cc · **Date**: 2026-07-03 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 이름은 make_**cc**(Closed Caption)인데 정작 **폐쇄자막의 핵심인 비음성 정보([음악]/[박수]/[웃음])가 없다.** 청각장애인·무음 시청 환경에서 "지금 음악이 흐르는지, 웃음이 터졌는지"를 알 수 없어 접근성이 반쪽. 초안 단계의 원래 비전(=CC 태깅 포함 자막)이 미구현 상태. |
| **Solution** | 워커 STT 파이프라인에 **SenseVoice-Small 오디오 이벤트 감지**를 추가해, 감지된 사운드 이벤트를 타임스탬프에 맞춰 **표준 CC 큐(`[음악]`, `♪`, `[박수]`, `[웃음]` 등)로 병합**. Whisper는 말 전사를 계속 담당. Whisper를 Turbo로 바꿔 같은 GPU에서 두 모델을 함께 돌릴 VRAM을 확보. |
| **Function/UX Effect** | 자막이 대사뿐 아니라 **소리 맥락**까지 전달. 편집기에서 사운드 큐를 speech 큐와 구분 표시·토글, SRT/번인에도 반영. 경쟁 자동자막(대사만)과의 **명확한 차별점 = "진짜 CC"**. |
| **Core Value** | **$0·온프렘 유지** + 우리 정체성(CC) 완성. SenseVoice는 경량·초저지연이라 처리 지연 최소. Turbo 스왑은 순수 이득(속도·VRAM). |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | CC의 본래 정의(비음성 정보 포함)를 충족해 접근성·차별성 확보. 사용자(초안 작성자)의 원 비전. 참조 문서(2026 STT 분석)가 SenseVoice를 "CC 접근성 향상 이상적 도구"로 지목. |
| **WHO** | ① 청각장애인·무음 시청자(접근성) ② 예능/브이로그/팟캐스트 크리에이터(소리 맥락이 중요한 콘텐츠). |
| **RISK** | ① SenseVoice 이벤트 **오탐**(잡음을 음악으로) → 신뢰 하락 ② GPU 메모리·처리 지연 증가 ③ 이벤트 태그가 대사 가독성 방해 ④ 신규 파이썬 의존성(funasr/modelscope) ⑤ Turbo 한국어 품질 저하 가능성. |
| **SUCCESS** | 업로드 영상에서 대사 자막 + 사운드 이벤트 CC 큐가 타임스탬프에 맞게 생성되고, 편집기에서 구분·토글·수정 가능, SRT/번인에 반영. Turbo로 처리시간·VRAM이 실측 개선되며 한국어 품질 회귀 없음. |
| **SCOPE** | IN: Turbo 스왑, SenseVoice 오디오이벤트 감지(워커), 이벤트→CC 큐 병합, Cue 타입 확장(kind), 편집기 구분표시·토글, SRT/번인 반영, 게이팅·테스트. OUT(이연): 감정(SER) 태깅, Qwen3-ASR/ForcedAligner 교체, 이벤트 기반 자동 스타일링, 실시간 스트리밍. |

---

## 목표 / 비목표

**목표**
- **m1 Turbo**: 워커 Whisper 기본 모델 `large-v3` → `large-v3-turbo`(faster-whisper 네이티브). 한국어 실측(정확도·속도·VRAM) 후 채택.
- **m2 SenseVoice 감지**: 워커에 `sensevoice.py`(FunAudioLLM) — 오디오 → `events[{startMs,endMs,label,confidence}]`(BGM/박수/웃음/기침/재채기 등). VAD 청크 재활용.
- **m3 병합**: 이벤트를 **CC 큐**로 변환(표준 관례: `♪` 음악, `[박수]`, `[웃음]`)해 speech 큐 타임라인에 병합. `Cue.kind: 'speech' | 'sound'` 도입.
- **m4 편집기/출력**: 사운드 큐 시각 구분(아이콘·톤)·토글(끄기), SRT 빌드·번인 반영.
- **m5 정책/QA**: 기본 ON(정체성)·무료 제공, 오탐 억제(confidence 임계·dedup), 단위/E2E 테스트.

**비목표(이연)**
- 감정(SER) 태깅, Qwen3-ASR·ForcedAligner 도입(코드스위칭/타임스탬프), 이벤트 기반 자동 자막 스타일, 실시간 처리.

---

## 핵심 설계 결정 (요약 — 상세는 Design)

| 항목 | 결정 | 근거 |
|------|------|------|
| 전사 코어 | **Whisper 유지(Turbo)** — 교체 아님 | 우리 한국어 품질 검증됨. SenseVoice는 이벤트 감지 전용으로 **증강**(리스크 최소) |
| 이벤트 모델 | **SenseVoice-Small** | 경량·NAR 초저지연·한국어·오디오이벤트 내장. 참조문서가 CC용으로 지목 |
| Turbo 스왑 이유 | VRAM 확보(6GB) → 같은 GPU에 SenseVoice 동거 | 순수 이득 + CC 기능의 인프라 토대 |
| 병합 단위 | 이벤트를 **별도 CC 큐**로 삽입(대사 큐와 분리) | SRT 표준 유지·토글 용이. `kind` 필드로 구분 |
| CC 표기 | 표준 관례: `♪ ... ♪`/`[박수]`/`[웃음]` | 국제 CC 컨벤션(Netflix/BBC) |
| 게이팅 | **기본 ON·무료** | CC는 정체성이지 프리미엄 게이트 아님. $0 차별화 유지 |
| 오탐 억제 | confidence 임계 + 인접 dedup + 최소 지속 | 신뢰 우선(잡음→음악 오탐 차단) |

### 통합 지점 (기존 코드)
| 신호/단계 | 위치 |
|------|------|
| STT 스크립트 | `worker/scripts/{whisper,whisperx}.py` → 신규 `sensevoice.py` |
| cue 처리·분할 | `worker/lib/cue-split.ts` |
| 오케스트레이션 | `worker/transcribe.ts` |
| Cue 타입 | `src/types/subtitle.ts` (`kind` 추가) |
| SRT 빌드 | services/subtitles(빌드 헬퍼) |
| 편집기 표시 | `features/editor/components/CueItem.tsx` 등 |

---

## 모듈맵 (구현 단위 — 분배)

| 모듈 | 산출물 | 내용 | 의존 |
|------|--------|------|------|
| **m1** Turbo 토대 | `whisper.py`/env/README | `large-v3-turbo` 채택 + 한국어 실측(속도·VRAM·품질) | 없음 (독립·선행) |
| **m2** 이벤트 감지 | `worker/scripts/sensevoice.py` + `worker/lib/sound-events.ts`(파서·정규화) | 오디오→events. VAD 청크 재활용. label 매핑(BGM→음악 등) | m1(VRAM) |
| **m3** 병합·타입 | `types/subtitle.ts`(`kind`), 병합 유틸 + SRT 빌드 | 이벤트→CC 큐 변환·타임라인 병합·오탐 억제. words 보존 | m2 |
| **m4** 편집기·출력 | `CueItem`·편집기 store, SRT/번인 경로 | 사운드 큐 구분표시·토글·수정, 번인 반영 | m3 |
| **m5** 정책·QA | 게이팅·테스트·QA 문서 | 기본 ON·무료, 단위(파서·병합)·E2E(실영상 이벤트) | m4 |

권장 진행: **m1(Turbo, 즉시·런칭 대비) → m2+m3(감지·병합, 한 사이클) → m4(UI) → m5**.

---

## 수용 기준 (Acceptance)

- [ ] **m1**: `large-v3-turbo`로 동일 영상 처리 시 VRAM↓·속도↑ 실측, 한국어 자막 품질 회귀 없음(육안+샘플 비교).
- [ ] BGM/박수/웃음이 포함된 영상 → 해당 시점에 `♪`/`[박수]`/`[웃음]` CC 큐가 타임스탬프에 맞게 생성.
- [ ] 대사 큐와 사운드 큐가 `kind`로 구분되고, 편집기에서 시각 구분·토글·수정 가능.
- [ ] SRT 다운로드·번인에 CC 큐 반영(토글 OFF 시 제외).
- [ ] 무음/조용한 영상에서 오탐(허위 음악 태그) 없음(confidence 임계 동작).
- [ ] 순수 함수(이벤트 파서·병합) 단위테스트 + 실영상 E2E 1건.
- [ ] tsc·eslint·vitest·next build 통과, 워커 tsc 통과.

---

## 열린 질문 (Design에서 확정)

- SenseVoice 구동 방식: `funasr` vs HF `transformers` vs ONNX — 의존성·설치 난이도·GPU 메모리 트레이드오프.
- 이벤트 라벨 집합/한글 매핑 확정([음악]/[박수]/[웃음]/[기침]/[재채기]/[관중] 등 어디까지).
- 사운드 큐가 대사와 시간 겹칠 때 표기 정책(별도 라인 vs 접두).
- Turbo 실측 결과에 따라 large-v3 병행 옵션 유지 여부.

## 다음 단계
- 본 Plan 리뷰 → Design(`docs/02-design/features/cc-rich-tagging.design.md`) → m1(Turbo)부터 구현.
- ⚠️ **유통 우선순위**([[distribution-plan]])와 병행: m1(Turbo)은 런칭 전 이득이라 선행, m2~는 실사용자 피드백과 함께. 워커 24/7는 [[project-monetization]] 선결.
