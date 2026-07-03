---
template: design
version: 1.0
feature: cc-rich-tagging
date: 2026-07-03
author: shong7500
project: make_cc
status: Draft
phase: phase-4 (워커 STT 파이프라인 + 편집기)
architecture: Dual-model (Whisper GPU 전사 + SenseVoice CPU 이벤트) → merge
plan_ref: docs/01-plan/features/cc-rich-tagging.plan.md
---

# 리치 CC(오디오 이벤트 태깅) + Whisper Turbo — Design

> **Architecture**: **이중 모델 병렬**. Whisper large-v3-turbo가 **GPU**에서 대사를 전사하고, SenseVoice-Small이 **CPU(ONNX)** 에서 비음성 오디오 이벤트를 감지한다. 두 결과를 타임라인에서 병합해 대사 큐 + 사운드 CC 큐(`♪`/`[박수]`/`[웃음]`)를 만든다.
> **핵심 근거(실측/환경 확인)**: ① m1 실측 = turbo가 large-v3 대비 1.54×·VRAM 44%↓·전사 동일. ② 워커 env에 `onnxruntime`(CPU 빌드) 이미 존재, `funasr`/`transformers` 없음 → **SenseVoice를 ONNX·CPU로 돌려 GPU 경합 0 + 의존성 최소**. SenseVoice는 NAR라 CPU에서도 초저지연.

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | make_**cc**(Closed Caption)의 본질인 비음성 정보([음악]/[박수]/[웃음]) 부재 → 접근성·차별성 미완. 사용자 원 비전. 런칭 차별점(“진짜 CC”). |
| **WHO** | 청각장애인·무음 시청자(접근성), 예능/브이로그/팟캐스트 크리에이터(소리 맥락 중요). |
| **RISK** | ① SenseVoice ONNX가 오디오 **이벤트 토큰**을 노출하는지 미확정(→ m2 스파이크로 검증, 실패 시 funasr 폴백) ② 오탐(잡음→음악) ③ CPU 추론 지연 ④ 신규 의존성(sherpa-onnx) ⑤ 이벤트 태그가 대사 가독성 방해. |
| **SUCCESS** | BGM/박수/웃음 포함 영상 → 해당 시점 CC 큐 생성, 편집기에서 대사/사운드 구분·토글·수정, SRT/번인 반영, 무음 오탐 없음. turbo로 회귀 없음(m1 완료). |
| **SCOPE** | IN: turbo(m1 완료), SenseVoice CPU 이벤트 감지, 병합, `Cue.kind`, 편집기 구분·토글, SRT/번인, 게이팅·테스트. OUT: 감정(SER) 태깅, Qwen3-ASR/ForcedAligner, 이벤트 기반 자동 스타일, 실시간. |

---

## 1. 아키텍처 개요

```
오디오(16kHz mono)
   │
   ├─(GPU) Whisper large-v3-turbo  ─ vad_filter=True → 대사 세그먼트(+words)  [기존 whisper.py/whisperx.py]
   │
   └─(CPU) SenseVoice-Small (ONNX) ───────────────→ 오디오 이벤트[{start,end,tag,conf}]  [신규 sensevoice.py]
                                                          │
                          ┌───────────────────────────────┘
                          ▼
  merge: 대사 큐(kind='speech') + 사운드 CC 큐(kind='sound', 표준표기) 를 타임라인 병합
   → buildSrt (사운드 = 별도 자막 라인) · 편집기 표시/토글 · 번인
```

**이중 모델 근거**: Whisper 한국어 전사 품질은 검증됨 → 유지. SenseVoice는 **이벤트 감지 전용으로 증강**(전사 교체 아님 = 리스크 최소). GPU는 Whisper, CPU는 SenseVoice로 **자원 분리**(경합 0). SenseVoice의 NAR 초저지연(70ms/10s)이라 CPU여도 파이프라인 지연 미미.

---

## 2. 열린 질문 확정 (Plan §열린 질문)

### Q1. 이벤트 감지 방식 → **sherpa-onnx(ONNX·CPU) — m2.0 스파이크로 API 검증 완료(2026-07-03)**
- 워커 env에 **onnxruntime 1.26(CPU) 이미 존재**, funasr/transformers/modelscope 없음. → onnxruntime 재활용, 무거운 의존성 회피.
- **`sherpa-onnx` 1.13.3 설치·API 확인 완료.** 이벤트 노출이 **API 레벨에서 확정**됨(funasr 폴백 불필요):
  - `OfflineRecognitionResult`(SenseVoice)에 **`event`·`emotion`·`lang` 필드 존재** — 이벤트 노출 확인.
  - 별도 **`AudioTagging`**(Zipformer/AudioSet) 제공: `AudioEvent{name, prob}` + `top_k`/`labels` — **명명된 사운드 이벤트 + confidence** 전용 분류기.
- **채택 방향(2트랙, m2에서 실측 후 확정)**:
  - **1순위: AudioTagging(AudioSet)** — 음악/박수/웃음/기침 등 명명 클래스 + 확률을 **시간 윈도잉**으로 감지 → CC 사운드 큐에 최적(명명·confidence·타임라인).
  - **대안: SenseVoice `.event`** — 세그먼트 단위 coarse 이벤트(더 경량).
- **CPU 근거**: onnxruntime CPU 빌드 + NAR/경량이라 빠름 → **GPU는 Whisper 전용**(경합 0). m1 VRAM 절감은 GPU 헤드룸으로 유지.
- ⚠️ **m2 잔여 검증(라이브)**: 모델 가중치 다운로드(~수백MB) + **이벤트 포함 실클립**으로 감지 정확도·라벨 커버리지 확인(API 노출은 확정, 정확도만 남음).

### Q2. 이벤트 라벨 한글 매핑 → **AudioSet 라벨군 → CC 표기 (라이브 검증 반영)**
m2 라이브 스파이크(2026-07-03)에서 실제 감지된 AudioSet 라벨 기준. 여러 세부 라벨을 하나의 CC 표기로 그룹핑:
| AudioSet 라벨(감지 예) | CC 표기(한국어) | 실측 |
|------|------|------|
| Music / Singing / A capella / Vocal music | `♪ 음악 ♪` | Music 0.79 ✅ |
| Laughter / Giggle / Snicker / Chuckle | `[웃음]` | Laughter 0.93 ✅ |
| Applause / Clapping / Cheering | `[박수]` | Clapping 감지(전용클립 필요) |
| Crying, sobbing / Baby cry | `[울음]` | Baby cry 0.91 ✅ |
| Cough | `[기침]` | AudioSet 클래스 존재 |
| Sneeze | `[재채기]` | AudioSet 클래스 존재 |
| **Speech / Male·Female speech** | (표기 안 함) | 대사=Whisper 담당. **한국어 말→Speech 0.98 정확분류=오탐 안전** |
| (그 외/불확실/저conf) | **버림** | 오탐 방지 |
- 감정(SER)은 **비목표**(이연). 이벤트만.
- 매핑은 `worker/lib/sound-events.ts` 상수(AudioSet 라벨→CC표기)로 단일 출처.
- **confidence 임계** 예: 주 이벤트 prob ≥ 0.5(음악/웃음/울음 등). Speech가 지배적이면 약한 비음성 태그 억제.

### Q3. 대사와 겹칠 때 표기 → **별도 사운드 큐(독립 라인)**
- 사운드 이벤트는 대사 큐에 접두하지 않고 **자체 타임스탬프의 독립 큐**(`kind='sound'`)로 삽입 → SRT 표준 유지·토글 용이·번인 시 별도 처리.
- 같은 시간대 대사와 겹치면 **둘 다 표시**(SRT는 동시간 큐 허용). 편집기는 사운드 큐를 시각 구분.
- **최소 지속·dedup**: 인접 동일 이벤트 병합, `MIN_EVENT_MS`(예 400ms) 미만·저confidence 버림.

### Q4. large-v3 병행 → **기본 large-v3-turbo, large-v3는 옵션 유지**
- m1 실측상 turbo 우위(속도·VRAM·동일 전사) → GPU 워커 **기본 turbo**. `WHISPER_MODEL`로 large-v3도 계속 선택 가능(제거 X, enum 유지).

---

## 3. 데이터 모델

`src/types/subtitle.ts` `Cue` 확장(하위호환, 옵션 필드):
```ts
export interface Cue {
  index: number; startMs: number; endMs: number; text: string;
  speakerId?: string; words?: WordTiming[];
  /** 큐 종류. 없으면 'speech'(기존 동작). 'sound'=비음성 CC(오디오 이벤트). */
  kind?: 'speech' | 'sound';
  /** sound 큐의 원시 이벤트 태그(BGM/Applause…). 디버그·재매핑용, 저장 옵션. */
  soundTag?: string;
}
```
- `kind` 미지정 = speech(기존 SRT/편집기/번역/번인 전부 무변경).
- **SRT 저장/재파싱**: SRT 포맷엔 kind 필드가 없음 → 사운드 큐는 표기 문자열(`♪...♪`/`[...]`) 그대로 저장. 재파싱 시 **휴리스틱**(`^♪.*♪$` 또는 `^\[.+\]$`)으로 kind='sound' 복원. (words 없음.)

워커 이벤트 표현(파이썬→노드 경계):
```ts
// worker/lib/sound-events.ts
export interface SoundEvent { startMs: number; endMs: number; tag: string; confidence: number; }
export function eventsToCues(events: SoundEvent[], opts): Cue[]; // 임계·dedup·표기매핑 (순수·테스트)
```

---

## 4. 모듈 상세 (Plan 모듈맵 대응)

### m1 — Turbo ✅ 완료
`WHISPER_MODEL=large-v3-turbo`(enum 추가·실측·채택). 본 Design의 GPU 전제.

### m2 — 사운드 이벤트 감지 (워커)
- **m2.0 스파이크**: ✅ **완료(API+라이브)**. sherpa-onnx AudioTagging(zipformer-small, AudioSet 527클래스, 111MB, `model.int8.onnx`, CPU) 실측: Music 0.79·Laughter 0.93·Baby cry 0.91 감지, **한국어 말→Speech 0.98(오탐 안전)**. → **AudioTagging 채택 확정**(SenseVoice.event 불요).
- `worker/scripts/sound_events.py`: 오디오 → sherpa-onnx AudioTagging **시간 윈도잉**(예 2s hop, 겹침) → 창별 top_k → 임계·인접 병합 → stdout JSON `events[{startMs,endMs,tag,confidence}]`. whisper.py 로깅/`emit` 패턴 미러. 모델은 `worker/models/`에 배치(gitignore, 최초 1회 다운로드 스크립트).
- `worker/lib/sound-events.ts`: 파이썬 출력 파싱 + 정규화(태그→표기 매핑, `MIN_EVENT_MS`, confidence 임계, 인접 dedup). **순수·테스트 대상**.
- 의존성: `sherpa-onnx`(wheel) — worker requirements에 추가. 모델은 최초 1회 다운로드.

### m3 — 병합 + 타입
- `types/subtitle.ts` `kind`/`soundTag` 추가.
- 병합 유틸: 대사 큐 + `eventsToCues()` 결과를 startMs 정렬 병합, index 재부여.
- `worker/transcribe.ts`: Whisper 결과 + SenseVoice 결과 병합 후 SRT 빌드·저장. SenseVoice는 Whisper와 **병렬 실행**(GPU/CPU 분리라 동시 가능) 후 join.
- SRT 빌드: 사운드 큐 = 표기 문자열 라인. words 없음(카라오케 비대상).

### m4 — 편집기 · 출력 ✅ 완료
- `CueItem.tsx`: `kind==='sound'` 큐를 시각 구분(앰버 톤 카드 + 🔊 사운드 배지, CPS 미표시), 편집·삭제 가능. 샘플 편집기에 데모 사운드 큐(♪음악♪) — 가입 전 CC 쇼케이스. 스크린샷 검증.

### m5 — 토글 · 정책 · QA ✅ 완료
- **표시 토글**: `useSubtitleStore.showSoundCues`(기본 true) + CueList 토글 버튼(사운드 큐 있을 때만). **뷰 전용·비파괴** — 숨겨도 데이터·저장·SRT 다운로드·번인엔 그대로 포함(저장 모델상 export 필터는 파괴적이라 채택 안 함). 검증: OFF→리스트 숨김.
- **정책**: 기본 ON·**무료**(CC는 정체성). 사용자 제어 = per-cue 삭제(개별 제거) + 표시 토글(뷰). 워커 베스트에포트.
- QA 문서 `docs/03-qa/cc-rich-tagging.qa.md`. 잔여 = 풀 E2E(실영상+이벤트, 수동).

---

## 5. 시퀀스

```
잡 처리(워커)
 → 오디오 추출(16kHz mono)
 → 병렬:
     A) GPU: whisper-turbo (vad) → 대사 세그먼트(+words)
     B) CPU: sensevoice.py → events[]
 → sound-events.eventsToCues(events)  (임계·dedup·표기매핑)
 → merge(대사 큐 + 사운드 큐) 정렬·인덱스
 → buildSrt → 저장(+words.json)
 → 편집기: kind로 구분 표시·토글 / SRT·번인 반영
```

---

## 6. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| ~~sherpa-onnx 이벤트 미노출~~ | **해소(2026-07-03 API 검증)**: SenseVoice `.event` + 전용 `AudioTagging{name,prob}` 확인. funasr 폴백 불필요. 잔여=라이브 정확도만 |
| 오탐(잡음→음악, 무음→이벤트) | confidence 임계 + MIN_EVENT_MS + dedup. 보수적 기본값(놓침 < 오탐) |
| CPU 추론 지연 | SenseVoice NAR(70ms/10s)라 무시 가능. Whisper와 병렬이라 벽시계 영향 ≈0 |
| 신규 의존성(sherpa-onnx) | 단일 wheel·onnxruntime 재활용. funasr 대비 경량 |
| 사운드 태그가 가독성 방해 | 별도 큐·토글 OFF 가능·기본 표기 절제(6종) |
| SRT 재파싱 kind 소실 | 표기 휴리스틱(`♪…♪`/`[…]`)으로 복원. 편집 세션은 워커 kind 직접 사용 |

---

## 7. 수용 기준 (Plan 승계 + 구체화)

- [ ] m2.0: 테스트 클립에서 SenseVoice가 BGM/웃음 이벤트를 타임스탬프와 함께 출력(로그 확인).
- [ ] `eventsToCues` 순수 단위테스트: 임계 미달·짧은 이벤트 버림, 인접 dedup, 태그→표기 매핑.
- [ ] 실클립 E2E: 대사 큐 + `♪음악♪`/`[웃음]` 사운드 큐가 시점에 맞게 생성, 편집기 구분·토글, SRT/번인 반영.
- [ ] 무음/조용한 클립 → 사운드 큐 0(오탐 없음).
- [ ] `kind` 미사용 기존 잡 회귀 없음(speech-only 동일 동작).
- [ ] tsc·eslint·vitest·next build·worker tsc 통과.

## 8. 다음 단계
- Design 리뷰 → **m2.0 스파이크(sherpa-onnx 이벤트 검증)** → m2~m5.
- ⚠️ 유통([[distribution-plan]])과 병행: CC는 **런칭 차별점**이므로 런칭 전 완성 가치 있음(사용자 판단). 워커 24/7는 [[project-monetization]] 선결.
