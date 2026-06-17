---
template: plan
version: 1.3
feature: speaker-diarization
date: 2026-06-14
author: shong7500
project: make_cc
status: Draft
---

# speaker-diarization Planning Document

> **Summary**: video-auto-caption의 STT 자막에 화자 분리(speaker diarization)를 추가해 다인 발화 영상에서 "누가 말하는지"를 자막에 표시. whisperX + pyannote.audio 도입.
>
> **Project**: make_cc
> **Version**: 0.3.0
> **Author**: shong7500
> **Date**: 2026-06-14
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 STT 자막은 음성→텍스트만 변환 → 드라마·인터뷰·회의 등 **다인 영상에서 "누가 말하는지" 표시 안 됨** → 진짜 CC 표준 미충족 |
| **Solution** | whisperX(pyannote.audio 내장)로 화자 임베딩·클러스터링 → 각 cue 앞에 `[화자 1]` 한국어 brackets 라벨 자동 부착. 1인 영상은 라벨 자동 숨김 |
| **Function/UX Effect** | 다인 영상에서 자막 가독성·접근성 향상 / 편집기에서 화자 이름 변경 가능(`화자 1 → 김지훈`) / 화자별 색상 표시 / 사용자가 켜고/끌 수 있음 |
| **Core Value** | "한국어 자막"에서 **진짜 한국어 CC(Closed Caption)**로 격상 — 청각 장애인 접근성 + 회의록 자동화 시장 진입 + 마케팅 정직성 회복 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 다인 영상 자막의 화자 미식별 → 가독성 저하 + CC 표준 미충족 |
| **WHO** | 콘텐츠 크리에이터(드라마·예능), 인터뷰·팟캐스트·회의록 작성자, 청각 장애인 사용자 |
| **RISK** | DER(Diarization Error Rate) 부정확 / GPU 메모리 +1GB / pyannote 이용약관 동의 운영 절차 |
| **SUCCESS** | DER ≤ 20%, 처리 시간 +30% 이내, 1인 자동 감지 정확도 ≥ 90%, CC 표현 마케팅 복원 |
| **SCOPE** | Phase1: 신규 잡 자동 적용 / Phase2: 편집기 켜기·끄기·이름 변경 / Phase3(out): 기존 잡 재처리 |

---

## 1. Overview

### 1.1 Purpose

video-auto-caption이 만든 SRT 자막에 화자 식별 라벨을 자동 부착하여, "한국어 자막"을 "한국어 CC(Closed Caption)" 수준으로 격상한다.

### 1.2 Background

- video-auto-caption v1 완료 시점에 사용자 피드백: **"지금은 STT로 한국어 자막만 나오는 거 아니야?"** (Plan #1 사후 분석 직후)
- 1차 타겟 영상이 **드라마·콘텐츠·인터뷰 복합** → 다인 발화가 일반적
- 현재 WER 3.8% (Plan #1 §4.2 마진 4배) → 정확도 여유 있어 다소 성능 손해를 감내할 수 있음
- RTX 4060 8GB → small + diarization = ~5GB 사용 → 메모리 마진 충분
- CC 표준: SMPTE TT, EBU-TT 등에서 화자 식별이 핵심 요소

### 1.3 Related Documents

- 이전 Plan: `docs/01-plan/features/video-auto-caption.plan.md`
- 이전 Design: `docs/02-design/features/video-auto-caption.design.md`
- 갭 분석 #2: `docs/03-analysis/video-auto-caption.analysis.md` (Match Rate 95%)
- 참고:
  - whisperX: https://github.com/m-bain/whisperX
  - pyannote/speaker-diarization-3.1 (3.x용): https://huggingface.co/pyannote/speaker-diarization-3.1
  - pyannote/speaker-diarization-community-1 (4.x 신모델): https://huggingface.co/pyannote/speaker-diarization-community-1

---

## 2. Scope

### 2.1 In Scope (Phase 1 + 2)

- [ ] worker에서 **whisperX 통합** (기존 faster-whisper 대체 또는 병행)
- [ ] **pyannote.audio 3.1** 도입 (HUGGINGFACE_TOKEN 필요)
- [ ] 신규 잡 자동 적용 (사용자 추가 옵션 없음 — 알아서 동작)
- [ ] **자동 화자 수 감지** (pyannote 내장)
- [ ] **1인 발화 자동 감지** → 라벨 자동 숨김 (UX 노이즈 제거)
- [ ] **한국어 brackets 라벨** 형식: `[화자 1] 안녕하세요.`
- [ ] DB `jobs` 테이블에 `speaker_map` JSONB 컬럼 추가 (id → display name)
- [ ] `Cue` 타입에 `speakerId?: string` 옵션 필드 추가
- [ ] SRT 빌드: cue.text 앞에 `[<speaker name>] ` prefix 자동 부착 (1인 제외)
- [ ] SRT 파싱: 기존 brackets 라벨 감지 + Cue.speakerId 복원
- [ ] **편집기 화자 토글**: "화자 라벨 표시" on/off 스위치
- [ ] **편집기 화자 이름 매핑 UI**: `화자 1 → 김지훈` 인라인 편집, 일괄 반영
- [ ] **화자별 색상 표시**: 4~6색 고정 팔레트 자동 배정
- [ ] PUT `/api/subtitles/[id]` 확장: `speakerMap` 필드 수용
- [ ] DB migration `0002_speaker_diarization.sql`
- [ ] `HUGGINGFACE_TOKEN` env 추가 + `.env.example` 갱신
- [ ] 메시지 회복: 랜딩 카피에 "CC" 다시 강조 (Phase 3 정직 정리 → 격상)
- [ ] worker README + 검증 절차 (한국어 검증 셋 1~2개)

### 2.2 Out of Scope (Phase 3+)

- 기존 처리된 잡 재처리 (사용자 결정)
- 화자 자동 인식 (목소리 → 인물 매핑 DB)
- 화자별 통계 (말한 시간, 발언 비율 등)
- 효과음·음악 감지 (별도 Plan: `audio-event-detection`)
- 다국어 화자 분리 (한국어 외)
- Edge function·서버리스 워커

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SD-FR-01 | 신규 영상 처리 시 화자 분리를 자동으로 수행한다 | High | Pending |
| SD-FR-02 | 화자 1명 감지 시 라벨을 자동으로 숨긴다 (cue.text 그대로) | High | Pending |
| SD-FR-03 | 다인 감지 시 cue.text 앞에 `[화자 N] ` prefix를 부착한다 | High | Pending |
| SD-FR-04 | SRT 파일 자체에도 라벨이 포함되어 외부 플레이어에서 그대로 보인다 | High | Pending |
| SD-FR-05 | 편집기에서 화자 이름을 변경할 수 있다 (`화자 1 → 김지훈`) | High | Pending |
| SD-FR-06 | 편집기에서 화자 라벨 표시를 토글할 수 있다 | High | Pending |
| SD-FR-07 | 편집기에서 화자별 색상이 자동 적용된다 (4~6색 팔레트) | Medium | Pending |
| SD-FR-08 | SRT 다운로드 시 매핑된 이름이 반영된 라벨이 들어간다 | High | Pending |
| SD-FR-09 | 기존 처리된 잡은 영향 받지 않는다 (speakerId 없음, 라벨 미부착) | High | Pending |
| SD-FR-10 | 1인/다인 자동 판정 임계값은 cue 80% 이상이 단일 화자면 1인으로 간주 | Medium | Pending |
| SD-FR-11 | DB jobs 테이블에 `speaker_map` JSONB 컬럼이 추가되고 RLS에 영향 없다 | High | Pending |
| SD-FR-12 | HF 토큰 미설정 시 워커는 화자 분리 없이 기존 동작으로 graceful degrade | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|--------------------|
| **Performance** | 처리 시간 증가 ≤ 30% (12.83× → ≥ 9× realtime) | 5분 영상으로 비교 측정 |
| **Accuracy** | DER (Diarization Error Rate) ≤ 20% | pyannote 평가 셋 |
| **Resource** | GPU 메모리 ≤ 6GB (small + pyannote) | nvidia-smi |
| **1인 감지 정확도** | 1인 영상이 잘못 다인으로 분류되는 비율 ≤ 10% | 검증 셋 30개 |
| **Backward Compat** | 기존 SRT 파서가 `[화자 N]` prefix를 만나도 정상 동작 | parseSrt 단위 테스트 |
| **Privacy** | 화자 임베딩(목소리 특징)은 워커 메모리에만 존재, 영구 저장 안 함 | 코드 리뷰 |
| **Graceful Degrade** | HF 토큰 미설정 / pyannote 로드 실패 시 기존 STT만으로 동작 | worker 로그 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] SD-FR-01 ~ SD-FR-12 모두 구현
- [ ] DB 마이그레이션 `0002_speaker_diarization.sql` 적용 + 롤백 검증
- [ ] worker:ingest로 다인 한국어 영상 1개 + 1인 영상 1개 검증
- [ ] 편집기에서 화자 이름 변경 → SRT 다운로드에 반영 확인
- [ ] 편집기 토글 → cue 라벨 표시 on/off 정상 동작
- [ ] HF 토큰 미설정 시 워커가 경고 후 화자 분리 skip
- [ ] SRT 파서 `[화자 N]` prefix 처리 단위 테스트 추가
- [ ] worker README에 HF 토큰 설정 절차 문서화

### 4.2 Quality Criteria

- [ ] DER ≤ 20% (한국어 다인 영상 5개 평균)
- [ ] 처리 시간 증가 ≤ 30%
- [ ] GPU 메모리 ≤ 6GB
- [ ] 1인 자동 감지 정확도 ≥ 90%
- [ ] 기존 SRT 파서 단위 테스트 회귀 0개

### 4.3 Business Criteria (관찰용)

- [ ] 랜딩 카피에 "CC"·"Closed Caption" 정직 복원 가능
- [ ] 회의록·인터뷰 카테고리 사용 비율 측정 (출시 후 1개월)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **pyannote 한국어 정확도 부족** | High | Medium | DER 20% 관대 기준 / 5개 검증 셋으로 baseline 측정 / fine-tuning 옵션 보존 |
| **GPU 메모리 초과** | Medium | Low | small + pyannote 5GB 예상, 8GB 마진 / VRAM 모니터링 알림 |
| **HF 토큰 운영 누락** | High | Medium | env 검증에서 옵션 처리 + graceful degrade / README에 설정 절차 명시 |
| **기존 SRT 파서 회귀** | High | Low | 단위 테스트로 prefix 감지·미감지 모두 검증 / parseSrt에 옵트인 옵션 |
| **편집기 화자 이름 매핑 복잡도** | Medium | Medium | speaker_map JSONB로 단일 진실, UI는 인라인 편집 단순화 |
| **1인 영상이 다인으로 잘못 분류** | Medium | Medium | cue 80% 이상 단일 화자 → 1인 판정 / 사용자 토글로 강제 숨김 가능 |
| **whisperX 의존성 충돌** | Medium | Low | 별도 venv 또는 worker 디렉터리 격리 / requirements.txt 버전 핀 |
| **처리 시간 증가로 사용자 이탈** | Low | Medium | 진행률 메시지에 "화자 분석 중" 단계 추가, 투명성 |

---

## 6. Impact Analysis

> **Purpose**: video-auto-caption의 기존 자산에 변경이 미치는 영향 명시.

### 6.1 Changed/New Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `jobs` table | DB Schema | `speaker_map JSONB DEFAULT '{}'::jsonb`, `diarization_enabled BOOLEAN DEFAULT true` 컬럼 추가 |
| `worker/scripts/whisperx.py` | New | whisperX + pyannote 통합 STT 스크립트 |
| `worker/lib/whisper.ts` | Modified | runWhisper에 speaker 필드 수신 추가 / 호환성 유지 |
| `worker/transcribe.ts` | Modified | Cue에 speakerId 부착, speaker_map 자동 생성 |
| `src/types/subtitle.ts` | Modified | `Cue.speakerId?: string` 추가 |
| `src/lib/srt.ts` | Modified | buildSrt: speaker_map + 라벨 prefix / parseSrt: prefix 감지 → speakerId 복원 |
| `src/services/storage` | None | 영향 없음 (SRT 텍스트 그대로 처리) |
| `src/services/jobs` | Minor | speaker_map 갱신 메서드 추가 |
| `src/app/api/subtitles/[jobId]` PUT | Modified | speakerMap 필드 수용 |
| `src/features/editor` | New | SpeakerLabelPanel, SpeakerMapEditor, useSpeakerToggle |
| `src/lib/env.ts` | Modified | `HUGGINGFACE_TOKEN` 옵션 추가 |
| `supabase/migrations/0002_speaker_diarization.sql` | New | 컬럼 추가 + RLS 영향 없음 검증 |

### 6.2 Current Consumers (기존 코드 영향 분석)

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| Cue type | 사용 | `src/lib/srt.ts`, `src/features/editor/*`, `worker/transcribe.ts` | speakerId optional → 기존 코드 무영향 |
| buildSrt | 호출 | `worker/transcribe.ts`, `src/app/api/subtitles/[jobId]/route.ts` PUT | 옵션 인자로 speakerMap 받음, 미전달 시 기존 동작 |
| parseSrt | 호출 | `src/app/api/subtitles/[jobId]/route.ts` GET, `src/app/s/[token]/page.tsx` | 라벨 prefix 옵트인 파싱, 기존 SRT는 평문 처리 |
| jobs 테이블 | RLS | 모든 routes | 신규 컬럼은 RLS 영향 없음 (Default 값) |
| worker/transcribe | 호출 | `worker/cli/*.ts` | speakerId 추출이 추가되나 기존 흐름 유지 |

### 6.3 Verification

- [ ] parseSrt가 `[화자 1] ` prefix를 만나도 cue.text는 정확히 추출되는지 단위 테스트
- [ ] buildSrt가 speaker_map 없이도 기존 SRT를 정확히 생성하는지
- [ ] 기존 처리된 잡(speaker_map = `{}`, diarization_enabled = true 기본값)이 정상 표시되는지
- [ ] PUT /api/subtitles가 speakerMap 미전송 시 기존 SRT 그대로 저장
- [ ] HF 토큰 없을 때 worker 로그가 명확히 안내하고 STT는 정상 진행

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

기존 video-auto-caption(**Dynamic Level**) 그대로 유지. 신규 모듈 일부만 추가.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| STT 엔진 통합 방식 | A. whisperX 도입 B. faster-whisper 유지 + pyannote 별도 | **A. whisperX 도입** | 통합 정렬·VAD·diarization 자동, 코드 단순. 단점은 의존성 증가 — 별도 venv로 격리 |
| 라벨 저장 방식 | A. SRT 텍스트에 prefix 부착 B. speaker_id를 별도 데이터로만 보관 | **A + B 하이브리드** | SRT는 자체 완결 (외부 플레이어 호환) + DB에 speaker_map 별도 (편집·이름 매핑) |
| 1인 자동 감지 임계값 | A. 전체 영상 단일 화자 B. cue 80% 이상 단일 화자 | **B. cue 80% 이상** | 짧은 다른 화자 잡음 허용 |
| 화자 이름 매핑 저장 | A. SRT 안 B. jobs.speaker_map | **B** | 이름은 자주 바뀜, SRT 재빌드 비용 절약 |
| 색상 팔레트 | A. 화자 ID별 hash → 색 B. 4~6색 고정 순환 | **B. 4~6색 고정** | 시각 일관성, 색맹 친화 (OKLCH 조정) |
| HF 토큰 처리 | A. 필수 B. 옵션(없으면 skip) | **B. 옵션 + graceful** | 로컬 개발 진입 장벽 ↓ |

### 7.3 Folder Structure Preview

```
worker/
  scripts/
    whisper.py          (기존 유지 — fallback)
    whisperx.py         (NEW)
  lib/
    whisper.ts          (확장, speaker 필드)
  requirements.txt      (whisperx, pyannote.audio 추가)

src/
  features/
    editor/
      components/
        SpeakerLabelToggle.tsx       (NEW)
        SpeakerMapEditor.tsx         (NEW)
      hooks/
        useSpeakerMap.ts             (NEW)
      lib/
        speaker-color.ts             (NEW — 색상 팔레트)
  lib/
    srt.ts                           (확장 — prefix 처리)
  types/
    subtitle.ts                      (Cue.speakerId 추가)
  app/
    api/subtitles/[jobId]/route.ts  (확장 — speakerMap 수용)

supabase/
  migrations/
    0002_speaker_diarization.sql     (NEW)
```

### 7.4 Data Flow

```
[Browser 업로드]
     ↓
[/api/uploads/init → complete]   (변경 없음)
     ↓
[Storage 영상]
     ↓
[Worker: whisperx.py]            ← NEW
  - faster-whisper STT
  - pyannote 화자 임베딩
  - 클러스터링 → speaker_id 할당
     ↓
[Cue[] with speakerId]
     ↓
[1인 감지 판정]                  ← NEW
  - cue 80% 이상 단일 화자 → speaker_map 비움
     ↓
[buildSrt(cues, speakerMap)]
  - speakerMap 있으면 라벨 prefix
  - 없으면 평문 (기존 동작)
     ↓
[Storage subtitles + jobs.speaker_map]
     ↓
[Editor]
  - GET /api/subtitles → cues + speakerMap
  - SpeakerLabelToggle on/off
  - SpeakerMapEditor 이름 매핑
  - PUT /api/subtitles → 갱신
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md` 존재
- [x] ESLint no-restricted-imports로 도메인 경계 강제
- [x] Pretendard 한국어 폰트
- [x] OKLCH 컬러 + Tailwind v4
- [x] 잡 상태 머신 + append-only 이벤트

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **화자 ID 형식** | 미정 | `spk_0`, `spk_1` ... (pyannote raw) → UI는 `화자 1`로 표시 | High |
| **화자 색상 팔레트** | 미정 | 4~6색 OKLCH (`oklch(0.7 0.15 [hue])`), `[280, 60, 145, 200, 30, 320]` | Medium |
| **라벨 prefix 규칙** | 미정 | `[<displayName>] <text>` 정확히 한 칸 공백 | High |
| **빈 화자 매핑** | 미정 | `speaker_map = {}` → 라벨 미부착 (= 기존 동작) | High |
| **Python 의존성 격리** | 단일 user site | 별도 venv 권장 (whisperx 의존성 충돌 방지) | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `HUGGINGFACE_TOKEN` | pyannote.audio 다운로드 인증 | Worker | ☐ |
| `WHISPER_DIARIZATION` | true/false, 워커가 화자 분리 켜기 (default true) | Worker | ☐ |
| `WHISPER_MIN_SPEAKERS` | pyannote 힌트 (default 1) | Worker | ☐ |
| `WHISPER_MAX_SPEAKERS` | pyannote 힌트 (default 10) | Worker | ☐ |

### 8.4 HF 토큰 설정 절차 (사용자용 README)

```
1. https://huggingface.co 가입 + 로그인
2. Settings → Access Tokens → New token (Read 권한)
3. pyannote 모델 3개 약관 동의 (각 페이지 회색 박스에서 회사·웹사이트 입력 후 Submit):
   - https://huggingface.co/pyannote/segmentation-3.0
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/speaker-diarization-community-1 (pyannote.audio 4.x 필수)
4. .env에 `HUGGINGFACE_TOKEN=hf_xxxxx` 추가
5. worker:poll 재시작
```

---

## 9. Next Steps

1. [ ] `/pdca design speaker-diarization` — 3개 아키텍처 옵션 비교 + Module Map
2. [ ] HF 토큰 사전 발급 + pyannote 약관 동의 (사용자)
3. [ ] (선택) 한국어 검증 영상 셋 2~3개 사전 준비 (1인 강의 + 다인 대화)
4. [ ] `/pdca do speaker-diarization --scope module-1` 부터 단계적

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-14 | Initial draft (요구사항 + 4 결정 Checkpoint 완료) | shong7500 |
