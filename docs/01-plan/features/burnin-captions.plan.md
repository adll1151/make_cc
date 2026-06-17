---
template: plan
version: 1.3
feature: burnin-captions
date: 2026-06-16
author: shong7500
project: make_cc
status: Draft
---

# burnin-captions Planning Document

> **Summary**: "음성→SRT 변환기"에서 **"한국어 스타일 번인(burn-in) 자막 메이커"**로 제품을 격상. 단어 단위 타이밍(whisperX) → 한글 폰트·색·카라오케 하이라이트 스타일 → ffmpeg로 영상에 자막을 입힌 **MP4 내보내기**(세로 9:16 / 원본 비율). 이게 구독(Pro) 전환의 핵심 가치.
>
> **Project**: make_cc
> **Version**: 0.6.0
> **Author**: shong7500
> **Date**: 2026-06-16
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 make_cc는 STT→SRT 변환만 제공 → **공짜 툴과 차별성 없어 구독 전환 0**. 시장 가치는 "짧은 영상용 스타일 번인 자막"으로 이동(Submagic $19~69/월). 글로벌 툴은 **영어 우선**이라 한글 폰트·스타일이 약함 |
| **Solution** | 단어 단위 타이밍 + **한글 스타일 번인 자막 MP4 내보내기**(세로/원본, 카라오케 하이라이트, 한국어 프리셋 템플릿). 무료=워터마크/720p, **Pro=워터마크 제거/HD + 스타일·템플릿** |
| **Function/UX Effect** | 편집기에서 자막 스타일 고르고 미리보기 → "번인 영상 내보내기" → Shorts/Reels/TikTok에 바로 올릴 MP4 다운로드. SRT만 받던 데서 **완성 영상**으로 |
| **Core Value** | "한국어 자막 변환기"에서 **"한국 크리에이터용 바이럴 자막 메이커"**로 격상 — 돈 낼 이유(번인·워터마크 제거·스타일)를 만들어 **구독 수익 구조의 토대** |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | SRT 변환은 공짜 commodity → 구독 가치 부재. 번인 스타일 자막 = willingness-to-pay #1. 글로벌 툴의 한국어 빈틈 공략 |
| **WHO** | 한국어 숏폼 크리에이터(유튜버·릴스·틱톡), 강의·홍보 영상 제작자. Submagic을 쓰기엔 영어 중심이라 불편한 한국 사용자 |
| **RISK** | ffmpeg 번인 렌더 부하(시간·GPU) / 한글 폰트 라이선스 / 출력 영상 스토리지 비용 / whisperX 단어 타이밍 정확도 |
| **SUCCESS** | 번인 MP4 정상 생성률 ≥ 95%, 세로 9:16 export, 한글 폰트 깨짐 0, 무료/Pro 게이팅 동작, 5분 영상 렌더 ≤ 2분 |
| **SCOPE** | Phase1: 단어타이밍 + ASS 스타일 + ffmpeg 번인 + 프리셋 + 게이팅 / Phase2: 번역 이중자막·이모지 강조·애니메이션 / Phase3(out): B-roll·AI훅·음악싱크·4K·배치 |

---

## 1. Overview

### 1.1 Purpose

video-auto-caption이 만든 자막을, **영상에 입혀(burn-in) 바로 업로드 가능한 MP4**로 내보내는 기능을 추가한다. 한글에 최적화된 스타일·템플릿으로, 글로벌 툴이 약한 한국어 숏폼 시장을 공략하고 **구독(Pro) 전환의 핵심 기능**을 만든다.

### 1.2 Background

- 시장 리서치(2026-06-16): "STT→SRT"는 무료화된 commodity. 유료 가치는 **번인 스타일 자막·카라오케 하이라이트·세로 export**로 이동. Submagic이 $19~69/월로 시장 주도.
- 글로벌 툴(Submagic·CapCut)은 **영어 우선** → 한글 폰트 렌더링·한국어 스타일·한국어 STT 정확도에 빈틈.
- make_cc 강점: self-host Whisper(GPU) + **ffmpeg 보유**(이미 사용 중) → 번인 렌더를 자체 파이프라인으로 구현 가능.
- 전제: 단어 단위 타임스탬프가 필요 → **whisperX**(speaker-diarization feature가 도입 중). 본 feature가 그 단어 타이밍을 소비.

### 1.3 Related Documents

- 이전 Plan: `docs/01-plan/features/video-auto-caption.plan.md` (SRT 생성)
- 이전 Plan: `docs/01-plan/features/speaker-diarization.plan.md` (whisperX 도입 — 단어 타이밍 기반 공유)
- 참고:
  - Submagic Review 2026 (기능·가격): https://ucstrategies.com/news/submagic-review-2026-pricing-features-is-it-worth-it-for-creators/
  - AI 자막 2026 필수기능(번인·번역·단어타이밍): https://www.opus.pro/blog/best-ai-subtitle-generators
  - Sonix SRT/VTT/Burn-In: https://sonix.ai/features/automated-subtitles
  - ASS(Advanced SubStation Alpha) / libass: ffmpeg `subtitles`/`ass` 필터

---

## 2. Scope

### 2.1 In Scope (Phase 1 — MVP)

- [ ] **단어 단위 타임스탬프**: whisperX word-level timestamps를 cue에 보존 (`Cue.words[]`)
- [ ] **ASS 자막 생성** (`lib/ass.ts`, pure): cue + 스타일 설정 → ASS 텍스트. 한글 폰트·크기·색·외곽선/그림자·위치 + **카라오케 단어 하이라이트**(`\k` 태그)
- [ ] **ffmpeg 번인 렌더**: 워커가 `ass` 필터로 자막을 영상에 입혀 MP4 출력
- [ ] **출력 비율**: 원본 비율 유지 + **세로 9:16 크롭 옵션**(숏폼용, 중앙 크롭)
- [ ] **한국어 프리셋 템플릿 3~5종** (폰트·색·위치 조합 — 예: 기본/굵은 노랑/하단 박스/상단/예능 자막)
- [ ] **편집기 스타일 패널**: 템플릿 선택 + 기본 커스텀(폰트·크기·색·위치) + 미리보기
- [ ] **"번인 영상 내보내기" 액션**: 렌더 잡 생성 → 진행률 → 완료 시 MP4 다운로드
- [ ] **무료/Pro 게이팅**: 무료 = **워터마크 + 720p**, Pro = **워터마크 제거 + 1080p + 전체 템플릿** (결제 시스템 없이 `is_pro` 플래그로 분기 — 추후 결제 연동)
- [ ] **한글 폰트 번들**: OFL 라이선스 폰트(Pretendard / Noto Sans KR 등) 워커에 포함
- [ ] DB/Storage: 렌더 결과 MP4 보관(`renders` 버킷) + 렌더 상태 추적
- [ ] 테스트: ass 빌더 단위테스트, 렌더 잡 통합(소형 영상)

### 2.2 Out of Scope (Phase 2+)

- 자동 번역 이중자막 (별도 feature `caption-translation`)
- 고급 애니메이션(단어 팝·바운스), 이모지 자동 강조, B-roll, AI 훅, 음악 비트 싱크
- 4K export, 일괄(batch) 렌더, 커스텀 폰트 업로드
- 자막 위치 키프레임(시간별 이동)

### 2.3 Out of Scope (영구)

- 풀 영상 편집기(컷·전환·BGM) — make_cc는 "자막"에 집중

---

## 3. Requirements

### 3.1 Functional

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| BC-01 | whisperX 단어 타임스탬프를 cue에 저장(`words[]`) | P0 |
| BC-02 | cue+스타일 → ASS 생성 (폰트·크기·색·외곽선·위치) | P0 |
| BC-03 | 카라오케 하이라이트(현재 단어 강조) ASS `\k` | P0 |
| BC-04 | ffmpeg로 자막 번인 → MP4 출력 | P0 |
| BC-05 | 세로 9:16 크롭 옵션(원본 유지가 기본) | P0 |
| BC-06 | 한국어 프리셋 템플릿 3~5종 | P0 |
| BC-07 | 편집기 스타일 패널 + 미리보기 | P0 |
| BC-08 | "번인 영상 내보내기" → 렌더 잡 → 다운로드 | P0 |
| BC-09 | 무료=워터마크+720p / Pro=제거+1080p 게이팅 | P0 |
| BC-10 | 렌더 진행률 표시(SSE 또는 폴링) | P1 |
| BC-11 | 렌더 출력 자동 삭제 정책(스토리지 관리) | P1 |

### 3.2 Non-Functional

| Category | Criteria |
|----------|----------|
| Performance | 5분 영상 번인 렌더 ≤ 2분 (≥ 2.5× realtime) |
| Quality | 한글 폰트 깨짐/네모(tofu) 0건, 자막 싱크 오차 ≤ 0.2s |
| Reliability | 번인 MP4 생성 성공률 ≥ 95% |
| Resource | 출력 720p/1080p, 파일 크기 합리화(crf 조정) |
| Licensing | 폰트는 OFL/무료 상업이용 가능만 |
| Security | 렌더는 워커(admin) — 본인 잡만, 출력은 signed URL |

### 3.3 Constraints

- **whisperX 의존**: 단어 타이밍이 전제 → speaker-diarization의 whisperX 통합과 공유/선행 필요
- **렌더는 워커에서만**: ffmpeg 번인은 CPU/GPU 부하 → 큐로 분산, 동시 렌더 제한
- **기존 SRT 흐름 무변경**: 번인은 **추가 산출물**, SRT 다운로드·편집기·공유는 그대로
- **결제 미연동**: Pro 게이팅은 `is_pro` 플래그로만(추후 Toss/Stripe)

---

## 4. Risks & Mitigations

| 위험 | 영향 | 대응 |
|------|------|------|
| ffmpeg 번인 렌더 부하/시간 | 워커 병목 | 별도 렌더 큐 + 동시성 제한 + 720p 기본, crf 튜닝 |
| 한글 폰트 깨짐(tofu) | 결과물 불량 | Noto Sans KR/Pretendard 번들 + 폰트 fontconfig 등록 검증 |
| whisperX 단어 타이밍 부정확 | 카라오케 어긋남 | cue 단위 fallback(단어 없으면 줄단위 표시), 임계 보정 |
| 출력 MP4 스토리지 비용 | 비용 증가 | renders 버킷 + 자동 삭제(무료 즉시/회원 N일) |
| Pro 게이팅 우회 | 수익 누수 | 렌더는 서버/워커에서 워터마크·해상도 강제(클라 신뢰 안 함) |
| 세로 크롭 시 자막 잘림 | UX 저하 | 크롭 영역 기준으로 자막 위치 재계산 + 미리보기 |

---

## 5. Implementation Approach

### 5.1 High-Level

1. **단어 타이밍**: whisperX 출력에서 word timestamps → `Cue.words[]` 보존 (speaker-diarization 파이프라인 확장)
2. **ASS 빌더**: `lib/ass.ts` pure 함수 — cue[] + CaptionStyle → ASS 문자열 (`\k` 카라오케)
3. **렌더 잡**: 새 잡 타입/단계 `render` — 워커가 원본 영상 + ASS → ffmpeg `-vf ass` → MP4(+선택 9:16 크롭, +워터마크 if 무료)
4. **스토리지**: `renders` 버킷에 출력 저장, signed URL 다운로드
5. **편집기 UI**: 스타일 패널(템플릿+커스텀) + 미리보기 + "내보내기" → 렌더 진행률
6. **게이팅**: `user_profiles.is_pro`(또는 plan) 기준 워터마크/해상도 분기

### 5.2 키 파일 (예상)

| 영역 | 파일 |
|------|------|
| ASS 빌더 | `src/lib/ass.ts` (pure) + `tests/unit/lib/ass.spec.ts` |
| 타입 | `src/types/caption-style.ts` (CaptionStyle, Template, RenderJob), `Cue.words` 확장 |
| 워커 렌더 | `worker/render.ts` (ffmpeg 번인), `worker/lib/ffmpeg.ts` 확장 |
| 폰트 | `worker/fonts/*` (Noto Sans KR / Pretendard, OFL) |
| 서비스 | `services/render/*` (렌더 잡 생성·상태), `services/storage` 확장(renders 버킷) |
| API/Action | `app/api/renders/*` 또는 server action |
| 편집기 UI | `features/editor/components/{CaptionStylePanel, TemplatePicker, ExportButton, RenderProgress}` |
| Migration | `supabase/migrations/*_renders.sql` (renders 추적 + is_pro) |

### 5.3 외부 의존성

- **ffmpeg**(보유) + **libass**(자막 필터) — 워커에 libass 빌드/패키지 확인 필요
- **whisperX**(speaker-diarization에서 도입) — 단어 타임스탬프
- 폰트(OFL) — 추가 패키지 아님, 파일 번들

---

## 6. Architecture Considerations

### 6.1 Project Level

기존 make_cc(Dynamic, Option C) 유지. 워커에 **렌더 단계 추가**(STT와 별개 잡 또는 후처리), 신규 인프라 없음(ffmpeg 재사용).

### 6.2 Key Decisions (Plan 차원 — Design에서 확정)

| Decision | 후보 | 잠정 |
|----------|------|------|
| 자막 포맷 | SRT 번인 / **ASS 번인** | **ASS** (스타일·카라오케 지원) |
| 렌더 위치 | 클라(WebCodecs) / **워커(ffmpeg)** | **워커** (품질·일관·게이팅 강제) |
| 출력 비율 | 세로만 / **원본+세로 크롭** | **원본 기본 + 9:16 옵션** |
| 잡 모델 | jobs 확장 / **별도 render 잡** | Design에서 결정 (별도 추적 유력) |
| 게이팅 | 클라 / **서버·워커 강제** | **서버·워커** (워터마크·해상도) |

### 6.3 Data Flow (개략)

```
[기존: 영상 → whisperX → cue(+words) → SRT]
        ↓ (신규)
[편집기: CaptionStyle 선택 + 미리보기]
        ↓ "번인 내보내기"
[렌더 잡 생성] → [워커: lib/ass(cue,style) → ASS]
        ↓
[ffmpeg: 원본영상 + ASS (+9:16 크롭 +무료 워터마크) → MP4]
        ↓
[renders 버킷 저장] → [signed URL 다운로드]
```

---

## 7. Success Criteria

- [ ] 단어 타임스탬프가 cue에 저장되고 카라오케 하이라이트가 싱크됨
- [ ] 한글 자막이 깨짐 없이 영상에 번인된 MP4 생성(성공률 ≥ 95%)
- [ ] 세로 9:16 크롭 출력 정상(자막 잘림 없음)
- [ ] 프리셋 3~5종 + 기본 커스텀 동작, 편집기 미리보기와 실제 출력 일치
- [ ] 무료=워터마크+720p / Pro=제거+1080p 게이팅이 서버·워커에서 강제됨
- [ ] 5분 영상 렌더 ≤ 2분
- [ ] 기존 SRT·편집기·공유 회귀 0

---

## 8. Timeline (Indicative)

| Phase | 산출물 | 추정 |
|-------|--------|------|
| 1.1 | whisperX 단어 타이밍 → Cue.words + 폰트 번들 | 1일 |
| 1.2 | `lib/ass.ts` + 단위테스트 (스타일·카라오케) | 1일 |
| 1.3 | 워커 렌더(ffmpeg ass 번인 + 9:16 + 워터마크) + renders 버킷 | 2일 |
| 1.4 | 렌더 잡/서비스/API + 진행률 | 1일 |
| 1.5 | 편집기 스타일 패널 + 템플릿 + 미리보기 + 내보내기 | 2일 |
| 1.6 | 게이팅(is_pro) + 자동삭제 + QA(한국어 영상 2~3개) | 1일 |
| **합계** | MVP | **~8일** |

---

## 9. Open Questions

- [ ] 출력 비율: 세로 9:16 외 정사각 1:1도 MVP에 넣을지 → Design
- [ ] 카라오케 하이라이트 기본 ON/OFF, 색상 정책 → Design
- [ ] 무료 워터마크 위치·문구(`make_cc`) → Design
- [ ] 렌더 큐를 기존 BullMQ로 합칠지 별도 큐로 분리할지 → Design
- [ ] is_pro 플래그를 user_profiles에 둘지 별도 subscriptions 테이블로 갈지(결제 대비) → Design
- [ ] 폰트 최종 선정(Pretendard vs Noto Sans KR vs 둘 다) → Design

---

## 10. Next Steps

1. [ ] `/pdca design burnin-captions` — ASS 스키마·렌더 파이프라인·잡 모델·UI 상세 (3 아키텍처 옵션)
2. [ ] whisperX 단어 타임스탬프 확보 상태 점검(speaker-diarization 진행도와 연계)
3. [ ] 워커 환경에 libass·폰트 사용 가능 여부 PoC (ffmpeg `-vf ass` 한글 1회 렌더)
4. [ ] `/pdca do burnin-captions --scope module-1`부터 단계적

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.6.0 | 2026-06-16 | Initial draft — 시장 리서치 기반 번인 자막 MVP 범위·로드맵 | shong7500 |
