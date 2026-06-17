---
feature: video-auto-caption
date: 2026-06-14
status: Check (#2)
matchRate: 95
stackVersion: 0.2 (Supabase)
modulesCompleted: 9
---

# video-auto-caption Gap Analysis #2 (Check Phase)

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 한국어 영상 자막 수동 작업 부담(4~6배 소요) 자동화 |
| **WHO** | 한국어 콘텐츠 크리에이터·영상 편집자·접근성 퍼블리셔 (1차), 게스트 체험 사용자 (유입) |
| **RISK** | GPU 비용·대기열 폭주 / 자막 정확도(고유명사) / 영상 프라이버시 |
| **SUCCESS** | 5분 영상 처리 ≤ 3분, WER ≤ 15%, 게스트→회원 전환율 ≥ 10% |
| **SCOPE** | Phase1: 업로드→자막→다운로드 / Phase2: 미리보기·편집 / Phase3: 회원 이력·공유 |

## Executive Summary

| 항목 | 결과 |
|------|------|
| **Overall Match Rate** (완료 모듈 기준) | **95%** |
| Critical Gaps | 0 |
| Important Gaps | 3 (1 신규, 2 지속) |
| Minor Gaps | 5 (1 신규, 3 지속, 1 해결) |
| Modules Completed | 9 / 11 |
| Plan SUCCESS Criteria 실측 통과 | 3/3 ✅ (WER 3.8%, 12.83× realtime, 2GB VRAM) |

산정 근거: 완료 모듈 9개의 Design 대비 충족도 평균.
모듈별 점수: 1=100, 2=98(+3, /login 구현), 3=100, 4=92(+4, markUploading), 5=92(신규), 6=98(신규, SUCCESS 실측 통과), 7=95(신규), 8=88(+8, 전 흐름 SSE 연동), 9=95(신규) → 평균 95.3% → **95%**.

이전 분석(92%) 대비 +3%p. 5/11 → 9/11 진척, 핵심 4모듈 추가에도 회귀 없이 향상.

## 1. 모듈별 진척 (1~11)

| Module | Scope Key | Status | Match | Notes |
|--------|-----------|--------|:-----:|-------|
| Bootstrap & Infra | module-1 | ✅ Done | 100% | 변경 없음 |
| Auth & Guest | module-2 | ✅ Done | 98% | `/login` 페이지 구현 완료 (Magic Link + Google). M-2 해결 |
| Domain Lib | module-3 | ✅ Done | 100% | 변경 없음 |
| Jobs & Storage & Queue | module-4 | ✅ Done | 92% | markUploading 호출 추가 (I-1 해결). Resumable Upload 미지원 지속 |
| Upload & Job APIs | module-5 | ✅ Done | 92% | `/api/uploads/[id]/complete`, `/api/jobs/[id]`, `/api/jobs/[id]/stream`(SSE 2초 폴링), `/api/jobs/[id]/cancel` 모두 구현. `/api/jobs` 이력 라우트 미존재 (FR-14 종속) |
| Worker | module-6 | ✅ Done | 98% | `worker/` 패키지 + faster-whisper + ffmpeg + 3 CLI 모드 (BullMQ + process-one + ingest-and-run + poll-loop). **SUCCESS Criteria 3/3 실측 통과** |
| Subtitle APIs & Notify | module-7 | ✅ Done | 95% | GET/PUT/download + Resend 회원 완료/실패 이메일. RFC 5987 한글 파일명 지원 |
| Upload UI | module-8 | ✅ Done | 95% | SSE 연결 완료 + StepDots + ETA + queued 30s stuck 안내. 이전 분석의 "SSE 미연결" 갭 해소 |
| Editor UI | module-9 | ✅ Done | 95% | EditorLayout/VideoPlayer/CueList/CueItem + Zustand store + 5초 디바운스 autoSave + useVideoSync(timeupdate→activeIndex) + Space play/pause |
| History & Share UI | module-10 | ⏳ Not started | — | `/jobs`, `/account`, `/s/[token]`, `/api/share/*`, `/api/jobs` (GET 이력) 미존재 |
| QA & Deploy | module-11 | ⏳ Not started | — | Playwright E2E 미작성, Dockerfile/배포 미완료, axe-core 미도입 |

진척률: **9/11 완료 = 82%** (이전 5/11+1부분 = 45%에서 +37%p)

## 2. Critical Gaps (즉시 수정)

**해당 없음.** 신규 4모듈(5/6/7/9)에서도 보안 위반·상태 머신 위반·검증 누락·정합성 문제 없음.

핵심 통과 항목 (신규 검증):
- `/api/uploads/[id]/complete`: getOwnerContext + 소유자 일치 + `if (job.status !== 'uploading')` 멱등성 보장 + markUploaded(state-machine 경유) — `route.ts:36-50`
- `/api/jobs/[id]/stream` SSE: 인증 검증 후에만 stream 시작, terminal 상태 도달 시 자동 종료, `req.signal.abort` 감지 — `stream/route.ts:65-72`
- `/api/subtitles/[id]` PUT: HTML 태그 거부 + validateCues + maxText 200 + normalizeCues 적용 → buildSrt 저장 — `route.ts:72-93`
- `/api/subtitles/[id]/download`: RFC 5987 (filename + filename*=UTF-8''…) 적용, 한글 영상명도 안전 — `download/route.ts:44-51`
- worker/transcribe.ts: queued→transcribing은 state-machine markStarted 경유, finished는 markFinished, 실패 시 markFailed — `transcribe.ts:66,147,179`
- worker fire-and-forget notify: `await`이 STT 스트림을 블록하지 않도록 의도된 분리 + catch로 워커 자체 실패 방지 — `transcribe.ts:160-167`
- lib/storage.putSubtitle: TextEncoder로 명시적 UTF-8 바이트 전송 → SDK의 charset 누락/오적용 우회 — `storage.ts:78-83`
- /api/jobs/[id]/video-url: 5분 만료 signed URL, 영상 storageKey 직접 노출 안 함 — `video-url/route.ts:29-32`

## 3. Important Gaps (신규/지속/해결)

### ✅ 해결: I-1 (uploads/init에서 markUploading 누락)
이전 분석 권장사항 그대로 적용. `/api/uploads/init/route.ts:54`에서 createJob 직후 `await markUploading(job.id)` 호출 → `/complete`가 state-machine 예외 없이 uploading→queued 전이 가능.

### ❌ 지속: I-2 (Resumable Upload(TUS) 미지원)
- **위치**: `src/lib/storage.ts:50-62`, `src/features/upload/lib/upload-client.ts`
- **현재 상태**: 단일 PUT XHR. 회원 1GB / 30분 영상의 모바일·불안정 회선에서 실패 위험.
- **권장**: 100MB 초과 시 `createResumableUploadSession` 분기 + `tus-js-client`. **module-11 직전에는 반드시 처리**.

### ❌ 지속: I-3 (Storage key prefix 불일치)
- **위치**: `src/lib/storage.ts:150-163` vs Design §3.4
- **현재 상태**: 의도된 변경(주석 명시)이나 Design 문서 미갱신.
- **권장**: Design §3.4를 "버킷 단위 lifecycle"로 갱신.

### 🆕 신규: I-5 (SSE keepalive와 progress 간격 불일치)
- **위치**: `src/app/api/jobs/[jobId]/stream/route.ts:22` (POLL_INTERVAL_MS = 2_000)
- **현재 상태**: 2초 폴링이 status/progress/keepalive를 모두 처리. 클라이언트 표시 지연 최대 2초.
- **권장**: Design §4.2에 "2초 폴링" 명시 또는 Postgres LISTEN/NOTIFY로 push 전환 (Phase 2).

## 4. Minor Gaps (신규/지속/해결)

### ✅ 해결: M-2 (/login 페이지 미구현)
Magic Link + Google OAuth 둘 다 동작. GuestCapBanner CTA 정상.

### ✅ 해결: M-3 (normalizeCues 미사용)
`/api/subtitles/[jobId]` PUT에서 적용.

### ❌ 지속: M-1 (Design 본문 v0.1 표현 잔존)
§2.1, §3.3, §7 본문 — 다음 design revision 일괄 처리.

### ❌ 지속: M-4 (incrementGuestDaily race condition)
운영 트래픽 발생 시 SQL function 또는 advisory lock 전환.

### ❌ 지속: M-5 (axe-core 미도입)
module-11 범위.

### 🆕 신규: M-6 (Editor CueList 가상 스크롤 미사용)
- **위치**: `src/features/editor/components/CueList.tsx:34-44`
- **현재 상태**: 단순 map 렌더. activeIndex로 scrollIntoView는 작동.
- **권장**: 30분 회원 영상 600+ cue 발생 시 `react-virtuoso` 검토. 현재 우선순위 낮음.

## 5. Plan Success Criteria 검증 (실측 반영)

### NFR — 실측 통과 (이전 ⏸️ → ✅)

| 기준 | 목표 | 실측 | 평가 |
|------|------|------|------|
| 5분 영상 처리 시간 | ≤ 180초 | ~23초 (12.83× realtime) | ✅ **7.8배 통과** |
| WER (한국어 일반) | ≤ 15% | 3.8% | ✅ **4배 통과** |
| GPU VRAM | ≤ 8GB | ~2GB (small 모델) | ✅ **4배 여유** |

→ Plan §4.2 Quality Criteria 핵심 3종 전부 통과. **medium/large-v3 업그레이드 여유 4배**.

### FR (Functional Requirements) — 평가 가능 항목

| ID | 요구사항 | 평가 |
|----|----------|------|
| FR-01 | 영상 업로드 | ✅ |
| FR-02 | 게스트 5분/200MB 1회 | 🟡 부분 |
| FR-03 | 회원 30분/1GB | ✅ |
| FR-04 | 이메일 + Google 소셜 | ✅ |
| FR-05 | ffmpeg + Whisper(ko) STT | ✅ |
| FR-06 | SRT 결과 | ✅ |
| FR-07 | 비동기, 화면 이탈 가능 | ✅ |
| FR-08 | 완료 이메일 알림 | ✅ |
| FR-09 | 영상 + 자막 미리보기 | ✅ |
| FR-10 | 자막 라인 편집 | ✅ |
| FR-11 | 편집 SRT 다운로드 | ✅ |
| FR-12 | 회원 공유 링크 | ⏳ module-10 |
| FR-13 | 공유 링크 익명 다운로드 | ⏳ module-10 |
| FR-14 | 회원 이력 페이지 | ⏳ module-10 |
| FR-15 | 큐 위치·진행률 | ✅ |
| FR-16 | 영상·자막 삭제 | ⏳ module-10 |
| FR-17 | N일 후 자동 삭제 | 🟡 부분 |

**FR 충족률**: 11/17 = **65%**, 4/17 module-10 종속, 2/17 부분.

### NFR — 기타

| 기준 | 평가 |
|------|------|
| OWASP Top 10 | ✅ (RLS + 트리거 + Zod + 보안 헤더 + RFC 5987) |
| Privacy 자동 삭제 | 🟡 (컬럼·인덱스 ✅, 삭제 잡 미구현) |
| Scalability | ⏸️ (부하 테스트 미실행) |
| Availability 99% | ⏸️ (미배포) |
| Accessibility WCAG AA | ⏸️ (axe-core 미도입) |
| Business: 전환율 ≥10% | ⏸️ (미배포) |

## 6. 강점 (신규/지속)

### 🆕 신규 강점 (이번 세션)
- **SUCCESS Criteria 4~8배 마진 통과**: medium/large 업그레이드 여유 4배
- **3-방식 worker CLI 설계**: BullMQ + process-one + ingest-and-run + poll-loop (Redis 의존성 그라데이션)
- **SSE 클라이언트 회복성**: queued 30s stuck 감지 + 워커 안내 메시지 자동 표시
- **friendlyStageMessage**: STT 진행률 구간별 자연어 메시지
- **자동 저장 + Beacon 가드**: 5초 디바운스 + beforeunload preventDefault
- **RFC 5987 한글 파일명**: ASCII fallback + UTF-8 percent-encoded
- **UTF-8 TextEncoder 명시**: Supabase Storage charset 누락/오적용 차단
- **fire-and-forget notify**: STT 스트림 블록 방지 + catch 격리
- **Editor 키보드 단축키 글로벌**: Space는 input/textarea 포커스 시에만 비활성

### ❌ 지속 강점 (이전 분석)
- 3-계층 ESLint 강제 (no-restricted-imports)
- 이중 방어 RLS + jobs_owner_consistency_trg 트리거
- 상태 머신 분리·테스트
- Job = 진실의 원천 (appendJobEvent 자동)
- SRT/timecode 라이브러리 품질
- CC 메시지 일관성

## 7. 다음 단계 권장

### 우선순위 1 — module-10 진입 전 정합성 정리 (0.5세션)
1. Design §2.1·§3.3·§7 본문을 v0.2 Supabase 표현으로 일괄 갱신 (M-1)
2. Design §3.4 Storage Key Convention vs 실제 구현 일치 (I-3)
3. Design §4.2 SSE 설명에 "서버 2초 폴링" 명시 (I-5)
4. Design §7/§10에 `mcc_anon` 쿠키 정책 등록 (I-4)

### 우선순위 2 — module-10 (History & Share UI)
- `/api/jobs` GET 이력, `/api/share` POST + `/api/share/[token]` GET/DELETE
- `/jobs`, `/s/[token]`, `/account` 페이지
- 자동 삭제 잡 (videoDeleteAt 활용 — FR-17 완성)
- 추정 30~40턴 단일 세션

### 우선순위 3 — module-11 (QA & Deploy) — Resumable Upload 필수
- **I-2 Resumable Upload 도입 필수** (회원 1GB 캡 사실상 사용 불가)
- Playwright E2E 4개
- `@axe-core/playwright` (M-5)
- Dockerfile + 배포

### 보고서 진입 조건 충족?
- Match Rate 95% ≥ 90% ✅
- Critical Gaps 0개 ✅
- 그러나 **FR-12~14, 16, 17은 module-10 종속 → Plan §4.1 DoD "FR-01~13 모두 구현" 미충족**
- **결론**: `/pdca report`는 module-10 완료 후 권장. 지금은 `/pdca do video-auto-caption --scope module-10`.

matchRate=95%, critical=0, important=3, minor=5
