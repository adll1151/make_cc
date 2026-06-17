---
template: design
version: 1.3
feature: speaker-diarization
date: 2026-06-14
author: shong7500
project: make_cc
status: Draft
---

# speaker-diarization Design Document

> **Summary**: whisperX(STT + pyannote 통합) 단일 Python entry + 순수 함수 `srt-labeling` 분리로 화자 라벨을 SRT 자체와 DB `speaker_map` JSONB에 양방향 보관. 편집기에서 화자 이름·색상·토글 제공.
>
> **Project**: make_cc
> **Version**: 0.3.0
> **Author**: shong7500
> **Date**: 2026-06-14
> **Status**: Draft
> **Planning Doc**: [speaker-diarization.plan.md](../../01-plan/features/speaker-diarization.plan.md)
> **Parent Feature**: video-auto-caption (v0.2 Supabase + Module 1-10 완료, Match Rate 95%)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema | ✅ (이 문서 §3) |
| Phase 2 | Convention | ✅ (이 문서 §10) |
| Phase 3 | Mockup | N/A (Tailwind v4 + shadcn 표준) |
| Phase 4 | API Spec | ✅ (이 문서 §4) |

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 다인 영상 화자 미식별 → 가독성 + CC 표준 미충족 |
| **WHO** | 콘텐츠 크리에이터, 인터뷰·팟캐스트·회의록, 청각 장애인 |
| **RISK** | DER 정확도 / GPU 메모리 +1GB / pyannote 운영 절차 |
| **SUCCESS** | DER ≤ 20%, 처리 시간 +30% 이내, 1인 감지 ≥ 90% 정확, CC 마케팅 복원 |
| **SCOPE** | Phase1: 신규 잡 자동 / Phase2: 편집기 토글·이름 변경 / Phase3(out): 기존 잡 재처리 |

---

## 1. Overview

### 1.1 Design Goals

- **시간 손실 최소화**: 처리 시간 증가 ≤ 30% (whisperX 단일 패스 + GPU float16)
- **회귀 위험 차단**: `srt-labeling.ts`를 pure 함수로 분리 → 기존 `srt.ts` 의존 코드 무영향 + 단위 테스트 용이
- **자연스러운 1인 처리**: 다인 임계 정책으로 UI 노이즈 제거 (1인이면 라벨 자체가 없는 자막)
- **편집 가능한 화자 이름**: SRT는 자동 매핑 결과를 항상 텍스트로 보유, DB `speaker_map`이 표시명의 진실 (재빌드 비용 없이 변경 가능)
- **외부 호환**: 다운로드 시 매핑된 표시명이 즉시 적용된 SRT — 외부 플레이어/YouTube 그대로 인식

### 1.2 Design Principles

- **Pure 함수 우선**: 라벨 prefix/parse는 input → output 결정적, 부수 효과 0
- **얇은 워커**: transcribe.ts는 변경 최소 — speaker 필드를 cue에 넣고 1인 감지 정책 한 번 호출
- **단일 진실 두 곳**: SRT(외부 호환) + `speaker_map`(편집기 표시명) — 빌드 시 매핑 적용
- **Backward compat 1순위**: 기존 SRT 파서가 `[화자 N]` prefix를 만나도 cue.text는 깨끗하게 추출
- **Graceful degrade**: HF 토큰 / pyannote 로드 실패 시 워커는 STT만으로 끝까지 진행

---

## 2. Architecture Options (선정 완료)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | **Option C: Pragmatic ⭐** |
|----------|:-:|:-:|:-:|
| **Approach** | 단일 Python 교체 + lib/srt 인라인 라벨 | services/diarization 완전 분리 | whisperX 단일 Python + srt-labeling pure 분리 |
| **New Files** | ~7 | ~18 | **~12** |
| **Modified Files** | ~5 | ~7 | **~6** |
| **Lines** | ~800 | ~1,800 | **~1,200** |
| **세션 수** | 1 | 2 | 1 |
| **테스트 용이** | ⚠️ | ✅ | ✅ |
| **회귀 위험** | 중 | 저 | **저** |
| **Recommendation** | Quick win | 장기 ops | **Default choice** |

**Selected**: **Option C — Pragmatic Pipeline**
**Rationale**: srt-labeling이 pure 함수로 분리되면 기존 srt 사용 코드(builds, parses, editor, api routes)에 회귀 위험 없이 라벨 로직 추가 가능. whisperX 단일 entry로 Python 의존성 격리 명확. 1세션 구현 가능 + 추후 Option B로 진화 가능.

### 2.1 Component Diagram

```
                                ┌─────────────────────────────────────┐
                                │   Browser (Next.js Client)          │
                                │   - Upload UI (변경 없음)            │
                                │   - Editor + SpeakerLabelToggle     │
                                │   - SpeakerMapEditor (이름 매핑)     │
                                └──────────┬──────────────────────────┘
                                           │
                                           ▼
                          ┌────────────────────────────────────┐
                          │   Next.js App (변경 부분만)         │
                          │   ┌──────────────────────────────┐ │
                          │   │ /api/subtitles/[id]          │ │
                          │   │   GET → cues + speakerMap    │ │
                          │   │   PUT → speakerMap 수용       │ │
                          │   └────────────┬─────────────────┘ │
                          │   ┌────────────▼─────────────────┐ │
                          │   │ services/jobs (확장)          │ │
                          │   │   - updateSpeakerMap()       │ │
                          │   └────────────┬─────────────────┘ │
                          │   ┌────────────▼─────────────────┐ │
                          │   │ lib/srt-labeling (NEW)        │ │
                          │   │   pure: applyLabels/strip     │ │
                          │   └────────────┬─────────────────┘ │
                          │   ┌────────────▼─────────────────┐ │
                          │   │ lib/srt (호출만 변경)         │ │
                          │   └─┬────────────┬────────────┬──┘ │
                          └────┼────────────┼────────────┼─────┘
                               │            │            │
                               ▼            ▼            ▼
                       ┌────────────┐ ┌──────────┐ ┌──────────┐
                       │ Supabase   │ │ Redis    │ │ Supabase │
                       │ Postgres   │ │ (변경 X) │ │ Storage  │
                       │ + spkr_map │ │          │ │ (SRT 자체)│
                       └────────────┘ └────┬─────┘ └──────────┘
                                           │
                                           ▼
                              ┌─────────────────────────────┐
                              │  GPU Worker                  │
                              │  ┌───────────────────────┐  │
                              │  │ transcribe.ts (확장)   │  │
                              │  │  1. ffmpeg            │  │
                              │  │  2. whisperX (NEW)    │  │
                              │  │  3. detector (1인 판정)│  │
                              │  │  4. applyLabels →SRT  │  │
                              │  │  5. update spkr_map   │  │
                              │  └───────────────────────┘  │
                              │  ┌───────────────────────┐  │
                              │  │ whisperx.py (NEW)     │  │
                              │  │  - faster-whisper STT │  │
                              │  │  - pyannote diarize   │  │
                              │  │  - segment.speaker    │  │
                              │  └───────────────────────┘  │
                              └─────────────────────────────┘
```

### 2.2 Data Flow

```
1. 영상 업로드 → 기존 흐름 (변경 없음)
   ↓
2. Worker pulls job
   ↓
3. ffmpeg → wav (변경 없음)
   ↓
4. whisperx.py:
   - STT segments 생성
   - pyannote diarize (cue 단위 화자 할당)
   - line-delimited JSON: { type:'segment', start, end, text, speaker }
   ↓
5. Node: cues[] 생성 (각 cue에 speakerId 부착)
   ↓
6. detector.isMultiSpeaker(cues):
   - cue 80% 이상 단일 화자 → false (1인)
   - 그 외 → true (다인)
   ↓
7. speakerMap 생성:
   - 1인: speakerMap = {}
   - 다인: { 'spk_0': '화자 1', 'spk_1': '화자 2', ... } (자동 이름)
   ↓
8. applyLabels(cues, speakerMap, mode='build'):
   - 빈 map이면 cue.text 그대로
   - 다인 map이면 cue.text에 '[<displayName>] ' prefix
   ↓
9. buildSrt(labeled cues) → Storage 업로드
   ↓
10. transitionStatus markFinished + jobs.speaker_map 저장
   ↓
11. Editor:
    GET /api/subtitles/[id] → cues + speakerMap
    SpeakerLabelToggle: cue 렌더링 시 prefix 강조 vs 평문
    SpeakerMapEditor: '화자 1' → '김지훈' 매핑 변경 → PUT
    PUT /api/subtitles/[id] {cues, speakerMap}:
      - parseSrt(저장된 SRT) → 라벨 strip (cue.text + speakerId)
      - applyLabels(cues, new speakerMap, 'build') → 새 SRT
      - jobs.speaker_map 동기 갱신
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `worker/scripts/whisperx.py` | whisperX, pyannote.audio, faster-whisper | STT + diarization |
| `worker/lib/whisper.ts` | whisperx.py | segment 스트림 + speaker 필드 |
| `worker/transcribe.ts` | lib/srt-labeling, services/jobs.updateSpeakerMap | 라벨 적용 + DB 저장 |
| `src/lib/srt-labeling.ts` | (없음, pure 함수) | label prefix/strip |
| `src/lib/srt.ts` | lib/srt-labeling | parse → strip 옵션, build → apply 옵션 |
| `src/app/api/subtitles/[id]` GET | jobs.getJobAdmin, storage.loadSubtitleText, parseSrt | speakerMap도 함께 응답 |
| `src/app/api/subtitles/[id]` PUT | applyLabels, buildSrt, services.jobs.updateSpeakerMap | speakerMap 수용 + SRT 재빌드 |
| `features/editor/SpeakerLabelToggle` | useSubtitleStore | UI 토글 |
| `features/editor/SpeakerMapEditor` | useSpeakerMap | 매핑 편집 UI |
| `features/editor/lib/speaker-color.ts` | (없음) | 색상 팔레트 |

---

## 3. Data Model

### 3.1 Entity Definition (TypeScript)

```typescript
// src/types/subtitle.ts (확장)
export interface Cue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  /** NEW (옵션): pyannote raw id (예: 'spk_0', 'spk_1') */
  speakerId?: string;
}

/** NEW: 화자 표시 이름 매핑 (jobs.speaker_map JSONB의 타입) */
export type SpeakerMap = Record<string, string>;
// 예: { 'spk_0': '화자 1', 'spk_1': '김지훈' }
// 빈 객체 {} = 1인 영상 또는 라벨 미사용

/** NEW: 편집기 표시용 컬러 매핑 (런타임 derived, 저장 안 함) */
export interface SpeakerStyle {
  id: string;
  displayName: string;
  colorIndex: number; // 0~5
}
```

### 3.2 jobs 테이블 변경

```sql
-- 추가 컬럼
ALTER TABLE public.jobs
  ADD COLUMN speaker_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN diarization_enabled BOOLEAN NOT NULL DEFAULT true;

-- RLS 영향 없음 (기존 정책이 컬럼별이 아닌 행 단위)
-- 기본값 적용으로 기존 행은 영향 없음
```

### 3.3 supabase/migrations/0002_speaker_diarization.sql

```sql
-- 0002: speaker diarization 컬럼 추가

alter table public.jobs
  add column if not exists speaker_map jsonb not null default '{}'::jsonb,
  add column if not exists diarization_enabled boolean not null default true;

comment on column public.jobs.speaker_map is
  '화자 ID → 표시 이름 매핑 (Record<string, string>). 빈 객체는 1인 영상 또는 라벨 미사용';
comment on column public.jobs.diarization_enabled is
  '워커가 화자 분리 수행 여부. 기본 true, .env로 전역 끔';

-- 인덱스 불필요 (조회는 단건 by id, JSONB 검색 안 함)
```

### 3.4 Storage 영향

- **subtitles 버킷**: SRT 자체에 `[<displayName>] ` prefix 부착됨 (다인일 때). 외부 다운로드 호환
- **새 객체 없음**

### 3.5 SRT 포맷 예시

#### 1인 (1인 자동 감지 → 라벨 미부착)

```srt
1
00:00:00,000 --> 00:00:02,400
안녕하세요. 오늘 강의를 시작하겠습니다.

2
00:00:02,500 --> 00:00:05,800
오늘 주제는 한국어 자막 자동 생성입니다.
```

#### 다인 (자동 매핑)

```srt
1
00:00:00,000 --> 00:00:02,400
[화자 1] 안녕하세요, 오늘 인터뷰에 응해주셔서 감사합니다.

2
00:00:02,500 --> 00:00:05,800
[화자 2] 안녕하세요. 좋은 자리 마련해주셔서 저도 감사합니다.
```

#### 다인 + 이름 매핑 (편집기에서 변경 후)

```srt
1
00:00:00,000 --> 00:00:02,400
[김지훈] 안녕하세요, 오늘 인터뷰에 응해주셔서 감사합니다.

2
00:00:02,500 --> 00:00:05,800
[박서연] 안녕하세요. 좋은 자리 마련해주셔서 저도 감사합니다.
```

---

## 4. API Specification

### 4.1 Endpoint Changes (기존 라우트 확장)

| Method | Path | Change |
|--------|------|--------|
| GET | `/api/subtitles/[jobId]` | 응답에 `speakerMap` 추가 |
| PUT | `/api/subtitles/[jobId]` | 요청에 `speakerMap` 옵션 수용 |
| GET | `/api/subtitles/[jobId]/download` | 매핑된 라벨 반영된 SRT 응답 (자동) |
| `/api/jobs/[jobId]` GET | 응답에 `diarizationEnabled` 추가 |

### 4.2 Detailed Specification

#### `GET /api/subtitles/[jobId]` (확장)

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "jobId": "ckxyz...",
    "language": "ko",
    "cues": [
      { "index": 1, "startMs": 0, "endMs": 2400, "text": "안녕하세요...", "speakerId": "spk_0" },
      { "index": 2, "startMs": 2500, "endMs": 5800, "text": "안녕하세요...", "speakerId": "spk_1" }
    ],
    "speakerMap": { "spk_0": "화자 1", "spk_1": "화자 2" },
    "updatedAt": "2026-06-14T10:23:00Z"
  }
}
```

**구현 노트**:
- 저장된 SRT를 parseSrt로 읽음
- parseSrt에 `{ extractLabels: true }` 옵션 전달 → `[<name>] text`를 분리하여 cue.text는 순수, speakerId는 prefix → 화자 ID 매핑
- `jobs.speaker_map`을 그대로 응답

#### `PUT /api/subtitles/[jobId]` (확장)

**Request:**
```json
{
  "cues": [
    { "index": 1, "startMs": 0, "endMs": 2400, "text": "안녕하세요...", "speakerId": "spk_0" }
  ],
  "speakerMap": { "spk_0": "김지훈", "spk_1": "박서연" }
}
```

**처리 흐름**:
1. Zod 검증 (cues 기존, speakerMap 새 스키마)
2. validateCues 기존
3. `applyLabels(cues, speakerMap, mode='build')` → labeled cues
4. `buildSrt(labeled cues)` → SRT 텍스트
5. `saveSubtitle({ jobId, srtText })` 기존
6. `services/jobs.updateSpeakerMap(jobId, speakerMap)` NEW

**Validation**:
- speakerMap key 형식: `spk_<n>` 또는 임의 문자열 (느슨)
- speakerMap value: 1~30자, HTML 태그 금지 (XSS 방어 동일)
- speakerMap 키 수: 최대 20 (실용 한계)

#### `GET /api/jobs/[jobId]` (필드 추가)

응답에 `diarizationEnabled: boolean` 추가 (UI에서 가능 여부 판단)

### 4.3 Service Layer Changes

```typescript
// services/jobs/service.ts (NEW 메서드)

export async function updateSpeakerMap(
  jobId: string,
  speakerMap: SpeakerMap,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('jobs')
    .update({ speaker_map: speakerMap })
    .eq('id', jobId);
  if (error) throw new Error(`speaker_map 갱신 실패: ${error.message}`);
}

export async function getSpeakerMap(jobId: string): Promise<SpeakerMap> {
  const job = await getJobAdmin(jobId);
  return (job?.speakerMap as SpeakerMap) ?? {};
}
```

```typescript
// rowToJob에 speaker_map / diarization_enabled 매핑 추가
function rowToJob(row: JobRow): Job {
  return {
    ...,
    speakerMap: row.speaker_map ?? {},
    diarizationEnabled: row.diarization_enabled ?? true,
  };
}
```

---

## 5. UI/UX Design

### 5.1 Editor Layout 확장

```
┌──────────────────────────────────────────────────────┐
│  ← 처음으로     [저장됨] [화자 라벨 ON] [공유] [SRT]   │  ← NEW Toggle
├──────────────────────────┬───────────────────────────┤
│   <video> player         │  Cue List                  │
│                          │  ┌──────────────────────┐ │
│   [김지훈] 안녕하세요    │  │ 1  00:00 → 00:02  ●  │ │  ← 색 dot
│   ───────────────────    │  │  [김지훈] 안녕하세요  │ │
│                          │  ├──────────────────────┤ │
│                          │  │ 2  00:02 → 00:05  ●  │ │  ← 다른 색
│                          │  │  [박서연] 좋아요...   │ │
├──────────────────────────┴───────────────────────────┤
│  화자 매핑                                            │  ← NEW
│  ┌────────────────────────────────────────────────┐  │
│  │ ● 화자 1  →  [김지훈        ] 발화 3분 20초    │  │
│  │ ● 화자 2  →  [박서연        ] 발화 2분 45초    │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 5.2 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SpeakerLabelToggle` | `features/editor/components/` | "화자 라벨 ON/OFF" 스위치 (저장 안 됨, 표시만) |
| `SpeakerMapEditor` | `features/editor/components/` | 화자 ID → 표시명 매핑 편집 + 발화 길이 표시 |
| `useSpeakerMap` | `features/editor/hooks/` | speaker_map store 동기화 + autoSave 통합 |
| `speakerColorByIndex` | `features/editor/lib/speaker-color.ts` | 0~5 → OKLCH 컬러 (색맹 친화 6색) |

### 5.3 User Flow

```
1. 편집기 진입 (다인 잡)
   - useSpeakerMap이 jobs.speaker_map 로드
   - CueItem이 cue.speakerId로 색 dot + 라벨 표시
   - "화자 라벨 ON" 토글 기본 켜짐

2. 사용자가 SpeakerMapEditor에서 "화자 1" → "김지훈" 입력
   - speakerMap 상태 갱신 → dirty=true
   - 5초 디바운스 → PUT /api/subtitles
   - 서버: applyLabels로 SRT 재빌드 + jobs.speaker_map 갱신
   - CueItem 라벨이 즉시 "김지훈"으로 갱신

3. "화자 라벨 OFF" 토글
   - UI에서만 라벨 prefix 숨김 (저장 SRT는 그대로)
   - 다시 켜면 즉시 표시

4. 1인 영상 진입
   - speakerMap = {} → SpeakerMapEditor 미표시 + Toggle 비활성
   - CueItem은 평문 cue.text 그대로
```

### 5.4 Color Palette (Speaker Colors)

```typescript
// features/editor/lib/speaker-color.ts
const SPEAKER_COLORS = [
  'oklch(0.7 0.15 280)',  // 보라
  'oklch(0.7 0.15 60)',   // 오렌지
  'oklch(0.7 0.15 145)',  // 그린
  'oklch(0.7 0.15 200)',  // 시안
  'oklch(0.7 0.15 30)',   // 빨강
  'oklch(0.7 0.15 320)',  // 마젠타
] as const;

export function speakerColorByIndex(idx: number): string {
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

export function speakerIndex(speakerId: string, map: SpeakerMap): number {
  // 안정성: speakerId → speaker_map key 순서로 인덱스 부여
  const keys = Object.keys(map).sort();
  const i = keys.indexOf(speakerId);
  return i >= 0 ? i : 0;
}
```

색맹 친화: hue 간격 60도 → 적록색맹도 구분 가능. lightness/chroma 동일 → 시각 일관성.

---

## 6. Error Handling

### 6.1 신규 에러 코드

| Code | HTTP | 사유 |
|------|:-:|------|
| `INVALID_INPUT` | 400 | speakerMap 형식 위반 (key 수 초과, value HTML 등) |
| (기존 코드 재사용) | — | NOT_FOUND, FORBIDDEN, OVERLAP 등 |

### 6.2 워커 실패 처리

- **whisperX 로드 실패** (HF 토큰 없거나 잘못됨, 약관 미동의):
  - `whisperx.py`가 emit `{type:'error', message:'pyannote 로드 실패 ...'}`
  - 워커는 fallback 모드 (env `WHISPER_FALLBACK_NO_DIARIZE=true`) → 일반 whisper.py로 재시도
  - speakerMap = {} 로 처리 → 라벨 없는 자막 생성, 워커 끝까지 성공
- **diarization 출력 일부 누락** (특정 cue에 speaker 없음):
  - 해당 cue는 speakerId 미부착 → SRT prefix도 없음
- **1인 다인 판정 경계값** (정확히 80%):
  - `cue 80% 이상` → 80% **초과**일 때 1인. `>=` 아닌 `>` 사용으로 다인 우선

### 6.3 UI 처리

- speakerMap 갱신 PUT 실패 → SaveStatusBadge에 error 표시 (기존 동작)
- 빈 speakerMap → SpeakerMapEditor + Toggle 비활성 (mute)
- speakerMap 키와 cue.speakerId 불일치 → 알 수 없는 화자는 `화자 ?`로 표시 + 경고 카드

---

## 7. Security Considerations

- [x] **XSS**: speakerMap value 입력 시 HTML 태그 거부 + 길이 30자 제한 (Zod)
- [x] **인가**: PUT /api/subtitles는 기존 owner 검증 + finished 잡만 (변경 없음)
- [x] **DoS**: speakerMap 최대 키 수 20개로 제한 (Plan 외부 영상 화자 수 대비)
- [x] **워커 권한**: speaker_map 갱신은 admin client (RLS 우회) — 기존 패턴
- [x] **프라이버시**: pyannote 임베딩(목소리 벡터)은 워커 메모리에만 — 영구 저장 안 함, 임시 파일 즉시 정리 (finally rm)
- [x] **HF 토큰**: env에 저장, 워커 컨테이너 외 노출 안 함

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| Unit | `srt-labeling.ts`: applyLabels/stripLabels round-trip | Vitest |
| Unit | `srt-labeling.ts`: 빈 map / 일부 cue 누락 / HTML 거부 | Vitest |
| Unit | `srt.ts`: parseSrt with extractLabels 옵션 (기존 회귀 0) | Vitest |
| Unit | `detector.ts`: 1인/다인 임계값 80% | Vitest |
| Unit | `speaker-color.ts`: deterministic index | Vitest |
| Integration | PUT /api/subtitles + speakerMap (mock storage) | Vitest + supertest |
| E2E (수동) | worker:ingest로 다인 한국어 영상 → SRT 라벨 확인 | manual |
| E2E (수동) | 편집기에서 이름 변경 → 다운로드 SRT 반영 확인 | manual |

### 8.2 Test Cases (Critical)

- [ ] applyLabels: 빈 speakerMap → cue.text 그대로
- [ ] applyLabels: 다인 → `[<name>] <text>` prefix 정확
- [ ] applyLabels: speakerId가 map에 없으면 → prefix 없음 (graceful)
- [ ] stripLabels: `[name] text` → `{ text: 'text', speakerId: 'name → match' }`
- [ ] stripLabels: prefix 없는 라인 → cue.text 그대로 (회귀 0)
- [ ] applyLabels → stripLabels → applyLabels 라운드트립 일치
- [ ] parseSrt({ extractLabels: true }): 라벨 + 평문 혼합 영상 처리
- [ ] detector.isMultiSpeaker(cues): 정확히 80% 단일 → 다인, 81% 단일 → 1인
- [ ] HTML 태그 있는 speakerMap value → 400 INVALID_INPUT
- [ ] 빈 speakerMap PUT → 기존 SRT 평문 저장
- [ ] PUT 후 GET → speakerMap + cues 정확히 복원

---

## 9. Clean Architecture (Option C 매핑)

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI 컴포넌트, hooks | `features/editor/components/{SpeakerLabelToggle, SpeakerMapEditor}`, `features/editor/hooks/useSpeakerMap` |
| **Application** | 도메인 서비스 | `services/jobs.updateSpeakerMap`, API route 핸들러 |
| **Domain** | 순수 함수, 타입 | `types/subtitle.Cue/SpeakerMap`, `lib/srt-labeling.{apply,strip}`, `lib/srt.{build,parse}`, `features/editor/lib/speaker-color` |
| **Infrastructure** | DB, Python, Storage | `worker/scripts/whisperx.py`, `worker/lib/whisper.ts`, `lib/supabase/admin` |

### 9.2 Dependency Rules

```
features/editor (Presentation)
   │
   ▼
api/subtitles (Application)
   │
   ▼
services/jobs (Application)
   │
   ▼
lib/srt + lib/srt-labeling (Domain)
   │
   ▼
lib/supabase/admin (Infrastructure)
```

- Presentation이 lib/srt-labeling을 직접 import OK (pure 함수, 안전)
- worker도 동일 (pure 함수 재사용)
- 어디서나 `applyLabels`, `stripLabels` 호출 가능 → 진실 단일화

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `SpeakerLabelToggle` | Presentation | `features/editor/components/` |
| `SpeakerMapEditor` | Presentation | `features/editor/components/` |
| `useSpeakerMap` | Presentation hook | `features/editor/hooks/` |
| `updateSpeakerMap` | Application | `services/jobs/service.ts` |
| `applyLabels` / `stripLabels` | Domain (pure) | `lib/srt-labeling.ts` |
| `isMultiSpeaker` | Domain (pure) | `lib/srt-labeling.ts` (같은 파일 또는 분리) |
| `speakerColorByIndex` | Domain (pure) | `features/editor/lib/speaker-color.ts` |
| `SpeakerMap` type | Domain | `types/subtitle.ts` |
| `whisperx.py` | Infrastructure | `worker/scripts/` |
| `runWhisper` (확장) | Infrastructure | `worker/lib/whisper.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming

| Target | Rule |
|--------|------|
| 화자 ID (워커 출력) | `spk_<n>` (pyannote raw) |
| 화자 표시명 (사용자 입력) | 1~30자 한글·영문·숫자·공백 |
| 색상 인덱스 | 0~5 (모듈 연산) |
| 환경 변수 | `WHISPER_DIARIZATION`, `HUGGINGFACE_TOKEN`, `WHISPER_MIN/MAX_SPEAKERS` |

### 10.2 SRT 라벨 형식

```
정규식: ^\[([^\]]+)\]\s+(.+)$
prefix: "[" + displayName + "] "
```

- `[`로 시작 + `]`로 닫힘 + 공백 1칸 + 텍스트
- displayName은 30자 제한, `[`, `]`, 줄바꿈 금지
- 1인 / 매핑 없을 때 prefix 미부착

### 10.3 Import 경계

기존 `eslint.config.mjs`의 `no-restricted-imports` 그대로 사용:
- `features/editor` ↔ `lib/srt-labeling` 직접 import OK (pure 함수, infra 아님)
- 서버 전용(admin client 등)은 services 경유 강제 유지

---

## 11. Implementation Guide

### 11.1 File Structure (변경/신규)

```
make_cc/
├── src/
│   ├── app/
│   │   └── api/subtitles/[jobId]/route.ts    (수정 — speakerMap 수용)
│   ├── lib/
│   │   ├── srt.ts                            (수정 — extractLabels 옵션)
│   │   └── srt-labeling.ts                   (NEW)
│   ├── services/jobs/
│   │   └── service.ts                        (수정 — updateSpeakerMap, getSpeakerMap, rowToJob)
│   ├── types/
│   │   ├── subtitle.ts                       (수정 — speakerId, SpeakerMap)
│   │   └── job.ts                            (수정 — Job.speakerMap, diarizationEnabled)
│   └── features/editor/
│       ├── components/
│       │   ├── SpeakerLabelToggle.tsx        (NEW)
│       │   ├── SpeakerMapEditor.tsx          (NEW)
│       │   ├── CueItem.tsx                   (수정 — 색 dot + 라벨)
│       │   └── EditorLayout.tsx              (수정 — 토글 + 매핑 패널)
│       ├── hooks/
│       │   ├── useSpeakerMap.ts              (NEW)
│       │   └── useSubtitleStore.ts           (수정 — speakerMap 상태 추가)
│       └── lib/
│           └── speaker-color.ts              (NEW)
├── worker/
│   ├── scripts/
│   │   └── whisperx.py                       (NEW)
│   ├── lib/
│   │   └── whisper.ts                        (수정 — speaker 필드 + diarization 분기)
│   ├── transcribe.ts                         (수정 — speakerMap 생성 + 라벨 적용)
│   ├── requirements.txt                      (수정 — whisperx 추가)
│   └── README.md                             (수정 — HF 토큰 절차)
├── supabase/migrations/
│   └── 20260615000001_speaker_diarization.sql  (NEW)
├── src/lib/env.ts                            (수정 — HUGGINGFACE_TOKEN 등)
├── .env.example                              (수정)
└── tests/unit/lib/
    └── srt-labeling.spec.ts                  (NEW)
```

### 11.2 Implementation Order

1. [ ] **Domain Lib + DB**: srt-labeling 순수 함수 + types + 단위 테스트 + DB migration
2. [ ] **Python 워커**: whisperx.py + requirements.txt + env + README
3. [ ] **Node 워커 통합**: lib/whisper.ts 확장 + transcribe.ts speakerMap 생성/적용
4. [ ] **API 확장**: /api/subtitles GET/PUT + services/jobs.updateSpeakerMap
5. [ ] **Editor UI**: useSpeakerMap + SpeakerLabelToggle + SpeakerMapEditor + CueItem 색 + EditorLayout 통합
6. [ ] **마케팅 복원 + 문서**: 랜딩·메일·메타 "CC" 회복, worker README 갱신, .env.example
7. [ ] **수동 E2E**: 다인/1인 한국어 영상 각 1개 worker:ingest 검증

### 11.3 Session Guide

> Auto-generated. Use `/pdca do speaker-diarization --scope module-N`.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Domain Lib + DB | `module-1` | `lib/srt-labeling.ts` (applyLabels/stripLabels/isMultiSpeaker 순수 함수) + types/subtitle/job 확장 + DB migration 0002 + `tests/unit/lib/srt-labeling.spec.ts` (10+ 케이스) | 25-30 |
| Python Worker | `module-2` | `worker/scripts/whisperx.py` (whisperX + pyannote 통합, line-JSON 스트림) + `requirements.txt` 갱신 + env + README HF 토큰 절차 + PoC 1회 실행 | 30-35 |
| Node Worker 통합 | `module-3` | `worker/lib/whisper.ts` segment에 speaker 필드 + `transcribe.ts`에 speakerMap 자동 생성 + `applyLabels`로 SRT 라벨 + `services/jobs.updateSpeakerMap` 호출 + graceful degrade (HF 토큰 없으면 일반 whisper.py로 fallback) | 30-35 |
| API + Service | `module-4` | `services/jobs.updateSpeakerMap` + `rowToJob`에 speakerMap/diarizationEnabled 추가 + `/api/subtitles/[id]` GET 응답에 speakerMap + PUT 요청에 speakerMap 수용 + Zod 스키마 확장 + 단위 테스트 (mock storage) | 20-25 |
| Editor UI | `module-5` | `useSpeakerMap` hook (Zustand 통합) + `SpeakerLabelToggle` + `SpeakerMapEditor` (이름 매핑 + 발화 길이) + `CueItem`에 색 dot + 라벨 표시 + `EditorLayout`에 패널 통합 + `lib/speaker-color.ts` | 30-35 |
| 마케팅 복원 + 문서 | `module-6` | 랜딩 카피 "CC" 복원 (정직성 회복) + 메일 템플릿 CC 표시 + metadata + .env.example + worker README HF 절차 정식화 + CLAUDE.md 화자 분리 섹션 | 15-20 |
| QA & 수동 E2E | `module-7` | 한국어 다인 영상 1개 + 1인 영상 1개로 worker:ingest 실행 → SRT 라벨 검증 → 편집기에서 이름 변경 → 다운로드 SRT 확인 + 회귀 단위 테스트 (기존 srt.spec.ts 영향) | 15-20 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 25-30 (완료) |
| Session 2 | Do | `--scope module-1,module-2` (도메인 + Python) | 50-60 |
| Session 3 | Do | `--scope module-3,module-4` (Node 워커 + API) | 50-60 |
| Session 4 | Do | `--scope module-5,module-6` (Editor + 마케팅) | 45-55 |
| Session 5 | Do + Check | `--scope module-7` + `/pdca analyze` | 30-40 |

**병목 식별**: module-2 (Python whisperX)가 환경 의존성 큼 — HF 토큰·약관 동의 사전 준비 필수. PoC 안 되면 module-3 진행 막힘. **사용자 사전 작업**:

```
1. https://huggingface.co 가입 + 로그인
2. Settings → Access Tokens → New token (Read 권한)
3. https://huggingface.co/pyannote/segmentation-3.0 → Submit (회색 박스, 회사·웹사이트 입력)
4. https://huggingface.co/pyannote/speaker-diarization-3.1 → Submit
5. https://huggingface.co/pyannote/speaker-diarization-community-1 → Submit (pyannote.audio 4.x 필수)
6. .env에 HUGGINGFACE_TOKEN=hf_xxxxx 추가
```

> **모델명 결정 (Note)**: 코드는 `pyannote/speaker-diarization-community-1` 우선,
> 실패 시 `pyannote/speaker-diarization-3.1` graceful fallback. pyannote.audio 4.x → community-1, 3.x → 3.1.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-14 | Initial draft (Option C, 7 모듈 분할, 5 세션 권장) | shong7500 |
