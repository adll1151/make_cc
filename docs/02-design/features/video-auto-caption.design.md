---
template: design
version: 1.3.1
feature: video-auto-caption
date: 2026-06-13
author: shong7500
project: make_cc
status: Draft (v0.2 — Supabase 스택 전환)
---

# video-auto-caption Design Document

> **Summary**: Next.js + **Supabase**(Auth/DB/Storage) + 별도 GPU 워커로 영상 업로드→Whisper(ko) STT→**CC(SRT)** 자막을 비동기 생성하고, 미리보기·편집·공유 링크를 제공하는 시스템 설계
>
> **Project**: make_cc
> **Version**: 0.2.0
> **Author**: shong7500
> **Date**: 2026-06-13
> **Status**: Draft (v0.2)
> **Planning Doc**: [video-auto-caption.plan.md](../../01-plan/features/video-auto-caption.plan.md)

> **⚠️ v0.2 변경사항 (2026-06-13)**:
> 사용자 의사 결정으로 인프라 스택을 변경했습니다. 본문의 일부 표현(NextAuth, Prisma, R2)은
> v0.1 기준이며, 아래 § Stack Pivot 섹션에서 변경 매핑을 참조하세요.
> 핵심 도메인 모델·API 스펙·UI 흐름은 그대로 유효합니다.

## Stack Pivot (v0.2)

| 영역 | v0.1 (이전) | v0.2 (현재) | 영향 |
|------|------------|------------|------|
| Auth | NextAuth.js v5 + Email + Google | **Supabase Auth** (Magic Link + OAuth) | `lib/auth.ts`, `app/api/auth/[...nextauth]` 제거, `lib/supabase/`, `app/auth/callback` 추가 |
| DB | PostgreSQL + Prisma | **Supabase Postgres** (RLS) | `prisma/` 제거, `supabase/migrations/*.sql` 추가, Prisma client → Supabase JS |
| Storage | Cloudflare R2 (S3 호환) | **Supabase Storage** (Signed URL / Resumable) | `lib/r2.ts` → `lib/storage.ts` |
| 큐 | BullMQ + Redis | (동일) | 변경 없음 |
| STT | Self-host Whisper | (동일) | 변경 없음 |
| Email | Resend | (동일) | 잡 완료 알림용. Supabase Auth는 자체 메일 발송 |
| 랜딩 카피 | "한국어 자막" | "**한국어 CC(폐쇄형 자막)**" | 사용자 인식 명확화 |

### 결정 이유

1. **운영 단순화**: Auth/DB/Storage가 하나의 콘솔에서 관리 → 운영 비용↓
2. **RLS 활용**: 잡 소유자 검증을 DB 레이어에서 강제 가능 (이중 방어)
3. **무료 티어**: 초기 MVP는 Supabase 무료 티어로 충분
4. **CC 명시**: 제품 메시지를 명확하게 — burn-in이 아닌 toggle 가능한 자막
5. **STT는 GPU 필요 → Supabase Edge Functions 불가**: BullMQ + Self-host Whisper 유지

### 코드 매핑 (v0.1 → v0.2)

| v0.1 파일 | v0.2 파일 | 비고 |
|----------|----------|------|
| `lib/db.ts` (Prisma client) | `lib/supabase/{server,browser,admin}.ts` | 3개 클라이언트로 분리 (RLS 컨텍스트별) |
| `lib/auth.ts` (NextAuth) | `lib/supabase/server.ts` + `app/auth/callback/route.ts` | |
| `lib/r2.ts` (S3 multipart) | `lib/storage.ts` (Supabase Storage) | Signed Upload URL 사용 |
| `prisma/schema.prisma` | `supabase/migrations/20260613000001_init.sql` | RLS 정책 + 트리거 포함 |
| `app/api/auth/[...nextauth]/route.ts` | `app/auth/callback/route.ts` | |
| `services/auth/quotas.ts` (Prisma) | `services/auth/quotas.ts` (Supabase admin) | 함수 시그니처 동일 |
| `services/auth/session.ts` (NextAuth) | `services/auth/session.ts` (Supabase auth.getUser) | 함수 시그니처 동일 |
| `services/auth/guards.ts` | (변경 없음) | 스택 비의존 — `assertCanUpload`는 그대로 |

### 본문 §3.3, §4.2의 영향

- §3.3 Prisma schema는 참고용. **실제 스키마는 `supabase/migrations/`** 가 정답
- §4.2 `/api/uploads/init`은 R2 멀티파트 presigned URL → Supabase Signed Upload URL로 응답 페이로드 변경 (구현 시 갱신)
- §2.1 컴포넌트 다이어그램에서 "PostgreSQL/R2" → "Supabase (Auth/DB/Storage)"로 통합 박스

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | [Schema Definition](../../01-plan/schema.md) | ❌ (이 문서 §3에서 정의) |
| Phase 2 | [Coding Conventions](../../01-plan/conventions.md) | ❌ (Plan §8 + 이 문서 §10) |
| Phase 3 | Mockup | N/A (MVP는 shadcn/ui 기본 활용) |
| Phase 4 | API Spec | ✅ (이 문서 §4) |

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 한국어 영상 자막 수동 작업 부담(4~6배 소요) 자동화 |
| **WHO** | 한국어 콘텐츠 크리에이터·영상 편집자·접근성 퍼블리셔 (1차), 게스트 체험 사용자 (유입) |
| **RISK** | GPU 비용·대기열 폭주 / 자막 정확도(고유명사) / 영상 프라이버시 |
| **SUCCESS** | 5분 영상 처리 ≤ 3분, WER ≤ 15%, 게스트→회원 전환율 ≥ 10% |
| **SCOPE** | Phase1: 업로드→자막→다운로드 / Phase2: 미리보기·편집 / Phase3: 회원 이력·공유 |

---

## 1. Overview

### 1.1 Design Goals

- **빠른 사용자 피드백**: 업로드 후 즉시 잡 ID 발급, 진행률 가시화, 완료 시 자동 알림
- **자원 효율**: GPU 워커는 1대로 시작 가능, 큐잉으로 폭주 방지, 게스트 캡으로 무료 사용자 학대 차단
- **느슨한 결합**: 웹(Vercel)과 워커(self-host GPU)는 DB + Redis + R2를 통해서만 통신 → 독립 배포·확장
- **편집 가능성**: SRT는 단순 파싱·재직렬화 구조로 다루어 클라이언트에서 안전하게 편집 후 저장
- **프라이버시 보장**: 영상은 처리 완료 후 자동 삭제(게스트 즉시, 회원 30일), 외부 학습에 사용하지 않음을 코드/약관에서 강제

### 1.2 Design Principles

- **얇은 컨트롤러 두꺼운 서비스**: API Route는 검증·인증·응답만, 도메인 로직은 `services/`에 위치
- **잡 = 진실의 원천**: 모든 상태 변화(업로드 완료, 워커 시작, STT 완료, 알림 발송)는 `Job` 행 업데이트로 표현
- **상태 머신 명시**: `pending → uploading → queued → transcribing → finished | failed | cancelled` — 모든 전이는 서비스에서만
- **이벤트 우선**: 비즈니스 이벤트(`job.finished`, `notification.sent`)는 `JobEvent` 테이블에 append-only로 기록 (감사 + 멱등성)
- **공유 도메인**: 웹/워커는 동일한 `services/`와 `lib/srt`, `lib/db`를 import하여 진실 단일화

---

## 2. Architecture Options (선정 완료)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | **Option C: Pragmatic ⭐** |
|----------|:-:|:-:|:-:|
| **Approach** | API Route에 직접 작성 | Domain/Application/Infrastructure 엄격 분리 + DI | features + services 레이어, repository는 Prisma 직접 |
| **New Files** | ~25 | ~70 | ~45 |
| **Modified Files** | - (greenfield) | - | - |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | 리팩토링 부채 | 출시 지연 | 컨벤션 미준수 시 효과 반감 |
| **Recommendation** | 빠른 출시 PoC | 장기 대규모 | **Default choice** |

**Selected**: **Option C — Pragmatic Modular**
**Rationale**: 웹(API Route)과 워커(BullMQ Worker)가 동일한 도메인 로직(STT 진행률 업데이트, SRT 저장, 알림 발송, 게스트 캡 체크)을 공유해야 함. Option A는 워커-웹 중복 코드를 강제하고, Option B는 MVP 일정에 과한 오버헤드. Option C가 `services/` 레이어를 통해 공유와 단순성을 동시에 만족.

### 2.1 Component Diagram

```
                                ┌─────────────────────────────────────┐
                                │   Browser (Next.js Client)          │
                                │   - Upload UI (chunked)             │
                                │   - Editor (영상 + SRT 오버레이)     │
                                │   - History / Share Pages           │
                                └──────────┬──────────────────────────┘
                                           │ HTTPS
                                           ▼
                          ┌────────────────────────────────────┐
                          │   Next.js App (Vercel)             │
                          │   ┌──────────────────────────────┐ │
                          │   │ API Routes (얇은 컨트롤러)    │ │
                          │   └────────────┬─────────────────┘ │
                          │   ┌────────────▼─────────────────┐ │
                          │   │ services/  (도메인 로직)      │ │
                          │   │   jobs / subtitles / storage │ │
                          │   │   queue / notify / auth      │ │
                          │   └─┬────────────┬────────────┬──┘ │
                          └────┼────────────┼────────────┼─────┘
                               │            │            │
                               ▼            ▼            ▼
                       ┌────────────┐ ┌──────────┐ ┌──────────┐
                       │ PostgreSQL │ │ Redis    │ │ Cloudflare│
                       │ (Prisma)   │ │ (BullMQ) │ │ R2       │
                       └────────────┘ └────┬─────┘ └──────────┘
                                           │
                                           │ pull job
                                           ▼
                              ┌─────────────────────────────┐
                              │  GPU Worker (Self-host)     │
                              │  Node.js + Python (Whisper) │
                              │  ┌───────────────────────┐  │
                              │  │ services/ 재사용       │  │
                              │  │ 1. R2 영상 다운로드    │  │
                              │  │ 2. ffmpeg 음성 추출    │  │
                              │  │ 3. Whisper(ko) STT    │  │
                              │  │ 4. SRT 생성 + R2 업로드│  │
                              │  │ 5. Job 상태 finished   │  │
                              │  │ 6. Resend 알림        │  │
                              │  └───────────────────────┘  │
                              └─────────────────────────────┘
```

### 2.2 Data Flow — Critical Path (영상 업로드 → 자막 다운로드)

```
1. Browser  → POST /api/uploads/init    (file size/duration 메타 + 인증)
   ← { uploadId, presignedUrls[], jobId }

2. Browser  → PUT presignedUrl (멀티파트 청크 N개 직접 R2로)
                                                                  
3. Browser  → POST /api/uploads/{uploadId}/complete (parts)
            → services.storage.completeMultipart(uploadId, parts)
            → services.jobs.markUploaded(jobId)
            → services.queue.enqueueTranscribe(jobId)         ── (Redis)
   ← { jobId, status: 'queued' }

4. Browser  → GET /api/jobs/{jobId}/stream  (SSE or polling 1~2s)
   ← stream of { status, progress, queuePosition }

5. Worker  pulls job from Redis
   → services.storage.downloadVideo(jobId)
   → ffmpeg → 16kHz wav
   → whisper.py --model large-v3 --language ko (progress callbacks)
   → services.jobs.updateProgress(jobId, %)        ── (DB)
   → SRT 생성 → services.storage.uploadSubtitle(jobId, srt)
   → services.jobs.markFinished(jobId, subtitleKey)
   → services.notify.sendCompletion(userId, jobId) ── (Resend)
   → services.storage.scheduleVideoDeletion(jobId)

6. Browser receives finished event (SSE) → 자동 라우팅 → /editor/{jobId}
   GET /api/subtitles/{jobId}  → SRT 본문
   사용자 편집 → POST /api/subtitles/{jobId}  (수정 SRT 저장)
   GET /api/subtitles/{jobId}/download  → 첨부 파일 응답
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| API Routes | services/* | 비즈니스 로직 호출 |
| services/jobs | lib/db, lib/redis | 잡 상태·이벤트 영속화, 큐 페치 |
| services/storage | lib/r2, lib/db | R2 멀티파트, 잡과 S3 키 매핑 |
| services/queue | lib/redis (BullMQ) | enqueue / job progress 채널 |
| services/stt (worker only) | lib/whisper (Python 호출) | STT 실행 + progress 콜백 |
| services/notify | lib/resend | 완료 이메일 |
| services/auth | next-auth, lib/db | 세션, 게스트 식별(쿠키 기반 anonymousId) |
| Worker | services/* (전체), lib/whisper | 동일 도메인 로직 재사용 |

---

## 3. Data Model

### 3.1 Entity Definition (TypeScript Domain Types)

```typescript
// src/types/job.ts
export type JobStatus =
  | 'pending'      // 잡 생성, 업로드 미완료
  | 'uploading'    // R2 멀티파트 진행 중
  | 'queued'       // BullMQ 큐 대기
  | 'transcribing' // 워커가 처리 중
  | 'finished'     // 자막 생성 완료
  | 'failed'       // 영구 실패
  | 'cancelled';   // 사용자 취소

export interface Job {
  id: string;                  // cuid
  ownerType: 'user' | 'guest'; // 게스트는 anonymousId 사용
  ownerId: string;             // userId 또는 anonymousId(쿠키)
  status: JobStatus;
  progressPercent: number;     // 0~100
  queuePosition: number | null;
  videoOriginalName: string;
  videoSizeBytes: number;
  videoDurationSec: number;
  videoStorageKey: string;     // R2 key
  subtitleStorageKey: string | null;
  language: 'ko';              // MVP는 ko 고정
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  videoDeleteAt: Date | null;  // 자동 삭제 예약 시각
}

export interface JobEvent {
  id: string;
  jobId: string;
  type: 'uploaded' | 'queued' | 'started' | 'progress' | 'finished' | 'failed' | 'cancelled' | 'notified';
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  emailVerified: Date | null;
  name: string | null;
  image: string | null;
  createdAt: Date;
}

export interface ShareLink {
  id: string;
  jobId: string;
  token: string;        // URL safe random (32+ chars)
  createdAt: Date;
  expiresAt: Date | null; // MVP: 영구 (null)
  revokedAt: Date | null;
  hits: number;
}

export interface DailyGuestUsage {
  date: string;         // YYYY-MM-DD (UTC)
  totalJobs: number;
  totalDurationSec: number;
}
```

### 3.2 Entity Relationships

```
[User] 1 ─────── N [Job]
                    │
                    ├── 1 ─── N [JobEvent]    (append-only 감사 로그)
                    │
                    └── 1 ─── 0..1 [ShareLink]

[Guest (anonymousId, 쿠키)] 1 ─── N [Job]    (ownerType='guest')

[DailyGuestUsage]          1 row / day  (게스트 글로벌 일일 캡)
```

### 3.3 Prisma Schema (PostgreSQL)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  createdAt     DateTime  @default(now())

  accounts Account[]    // NextAuth
  sessions Session[]    // NextAuth
  jobs     Job[]

  @@map("users")
}

// NextAuth tables (Account, Session, VerificationToken) — Auth.js v5 표준 스키마, 여기서는 생략 표기

model Job {
  id                  String     @id @default(cuid())
  ownerType           OwnerType
  ownerId             String              // userId or anonymousId
  status              JobStatus  @default(pending)
  progressPercent     Int        @default(0)
  queuePosition       Int?

  videoOriginalName   String
  videoSizeBytes      BigInt
  videoDurationSec    Int
  videoStorageKey     String
  subtitleStorageKey  String?

  language            String     @default("ko")
  errorCode           String?
  errorMessage        String?

  createdAt           DateTime   @default(now())
  startedAt           DateTime?
  finishedAt          DateTime?
  videoDeleteAt       DateTime?

  user                User?      @relation(fields: [ownerId], references: [id], onDelete: SetNull, map: "Job_userOwner_fkey")
                                  // FK는 ownerType='user'일 때만 의미. Prisma는 조건 FK 불가 → 앱 레이어에서 검증
  events              JobEvent[]
  shareLink           ShareLink?

  @@index([ownerType, ownerId, createdAt(sort: Desc)])
  @@index([status, createdAt])
  @@index([videoDeleteAt])
  @@map("jobs")
}

enum OwnerType {
  user
  guest
}

enum JobStatus {
  pending
  uploading
  queued
  transcribing
  finished
  failed
  cancelled
}

model JobEvent {
  id        String   @id @default(cuid())
  jobId     String
  type      String           // 'uploaded' | 'queued' | 'started' | 'progress' | 'finished' | 'failed' | 'cancelled' | 'notified'
  payload   Json
  createdAt DateTime @default(now())

  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, createdAt])
  @@map("job_events")
}

model ShareLink {
  id        String    @id @default(cuid())
  jobId     String    @unique
  token     String    @unique
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  revokedAt DateTime?
  hits      Int       @default(0)

  job       Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([token])
  @@map("share_links")
}

model DailyGuestUsage {
  date              String   @id          // 'YYYY-MM-DD'
  totalJobs         Int      @default(0)
  totalDurationSec  Int      @default(0)

  @@map("daily_guest_usage")
}
```

**FK 주의**: Prisma는 조건부 FK(ownerType이 'user'일 때만 User.id 참조)를 지원하지 않아, `Job.ownerId`는 일반 컬럼으로 두고 `services/auth` 레이어에서 검증한다. 향후 `User`와 분리된 `Guest` 테이블로 정규화 가능.

### 3.4 Storage Key Convention (R2)

| Bucket | Key Pattern | Lifetime |
|--------|-------------|----------|
| `make-cc-videos` | `videos/{yyyy}/{mm}/{jobId}/{filename}` | 게스트 즉시 삭제 / 회원 30일 |
| `make-cc-subtitles` | `subtitles/{yyyy}/{mm}/{jobId}/{jobId}.srt` | 회원 30일, 게스트 1시간 |
| (R2 lifecycle rule) | prefix `videos/` → expire 30 days; `subtitles/` → expire 30 days | 백업 안전망 |

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/uploads/init` | 멀티파트 업로드 초기화 + Job 생성 | Guest 허용 |
| POST | `/api/uploads/{uploadId}/complete` | 멀티파트 완료 → 큐잉 | 해당 Job 소유 |
| POST | `/api/uploads/{uploadId}/abort` | 업로드 중단 | 해당 Job 소유 |
| GET | `/api/jobs/{jobId}` | 잡 메타·상태 조회 | 해당 Job 소유 또는 공유 토큰 |
| GET | `/api/jobs/{jobId}/stream` | SSE로 진행 상태 스트림 | 해당 Job 소유 |
| POST | `/api/jobs/{jobId}/cancel` | 잡 취소 | 해당 Job 소유 |
| GET | `/api/jobs` | 내 잡 이력 (회원) | Required |
| GET | `/api/subtitles/{jobId}` | SRT 본문(JSON 라인 배열) | 해당 Job 소유 또는 공유 토큰 |
| PUT | `/api/subtitles/{jobId}` | SRT 편집 저장 | 해당 Job 소유 |
| GET | `/api/subtitles/{jobId}/download` | SRT 첨부 파일 다운로드 | 해당 Job 소유 또는 공유 토큰 |
| POST | `/api/share` | 공유 링크 생성 | 회원만 |
| DELETE | `/api/share/{token}` | 공유 링크 폐기 | 회원만 |
| GET | `/api/share/{token}` | 공유 링크 조회 (공개) | 공개 |
| —    | `/api/auth/*` | NextAuth handler | — |

### 4.2 Detailed Specification

#### `POST /api/uploads/init`

**Purpose**: 영상 메타로 멀티파트 업로드 세션과 잡을 생성. 게스트 캡/회원 캡을 사전 검증.

**Request:**
```json
{
  "fileName": "lecture.mp4",
  "fileSize": 187654321,
  "durationSec": 290,
  "mimeType": "video/mp4"
}
```

**Response (201 Created):**
```json
{
  "jobId": "ckxyz...",
  "uploadId": "r2-mpu-xyz",
  "partSize": 8388608,
  "presignedUrls": [
    { "partNumber": 1, "url": "https://...r2.dev/...", "expiresIn": 3600 },
    { "partNumber": 2, "url": "https://..." }
  ]
}
```

**Validation Rules** (services/auth + services/jobs):
- 게스트: `durationSec ≤ 300` AND `fileSize ≤ 200_000_000`
- 회원: `durationSec ≤ 1800` AND `fileSize ≤ 1_073_741_824`
- 게스트 글로벌 일일 캡 초과 시 거부
- 게스트 세션당 1회 (쿠키 `anonymousId` + DailyGuestUsage)
- `mimeType` 화이트리스트: `video/mp4`, `video/quicktime`, `video/x-matroska`, `video/webm`

**Error Responses:**
- `400 INVALID_INPUT`: 메타 누락/형식 오류
- `401 AUTH_REQUIRED`: 회원 한도 초과 후 로그인 필요
- `413 PAYLOAD_TOO_LARGE`: 파일·길이 제한 초과 — 메시지에 한도 명시
- `429 QUOTA_EXCEEDED`: 게스트 일일/세션 캡 도달
- `415 UNSUPPORTED_MEDIA_TYPE`: MIME 비허용

#### `POST /api/uploads/{uploadId}/complete`

**Purpose**: 모든 청크가 R2에 도달했음을 알리고 멀티파트 완료 + 큐잉.

**Request:**
```json
{
  "parts": [
    { "partNumber": 1, "etag": "\"abc...\"" },
    { "partNumber": 2, "etag": "\"def...\"" }
  ]
}
```

**Response (200 OK):**
```json
{
  "jobId": "ckxyz...",
  "status": "queued",
  "queuePosition": 3
}
```

**Side Effects**:
- `services.storage.completeMultipart(uploadId, parts)`
- `services.jobs.transition(jobId, 'uploading' → 'queued')`
- `services.queue.enqueueTranscribe(jobId)` (BullMQ job, priority = ownerType==='user' ? 1 : 5)
- `JobEvent { type: 'uploaded' }`, `JobEvent { type: 'queued' }`

#### `GET /api/jobs/{jobId}/stream` (SSE)

**Purpose**: 잡 상태 실시간 스트림. 화면 이탈 후 재진입 가능(`Last-Event-ID` 지원).

**Response (text/event-stream):**
```
event: status
data: {"status":"queued","queuePosition":3,"progress":0}

event: status
data: {"status":"transcribing","progress":12}

event: status
data: {"status":"transcribing","progress":67}

event: status
data: {"status":"finished","progress":100,"subtitleUrl":"/api/subtitles/ckxyz/download"}
```

**Fallback**: SSE 미지원 클라이언트는 `GET /api/jobs/{jobId}` 2초 폴링.

#### `GET /api/subtitles/{jobId}`

**Response (200 OK):**
```json
{
  "jobId": "ckxyz...",
  "language": "ko",
  "cues": [
    { "index": 1, "startMs": 0,    "endMs": 2400,  "text": "안녕하세요." },
    { "index": 2, "startMs": 2500, "endMs": 5800,  "text": "오늘 강의를 시작하겠습니다." }
  ],
  "updatedAt": "2026-06-13T10:23:00Z"
}
```

#### `PUT /api/subtitles/{jobId}`

**Request:**
```json
{
  "cues": [
    { "index": 1, "startMs": 0,    "endMs": 2400, "text": "안녕하세요, 여러분." },
    { "index": 2, "startMs": 2500, "endMs": 5800, "text": "오늘 강의를 시작합니다." }
  ]
}
```

**Validation**:
- `cues`는 `startMs < endMs` 보장
- 인접 cue는 `prev.endMs ≤ next.startMs` (겹침 금지) — 위반 시 `400 OVERLAP`
- `text`는 최대 200자, HTML 태그 금지 (XSS 방어)

**Response (200 OK):**
```json
{ "jobId": "ckxyz...", "updatedAt": "2026-06-13T10:25:00Z" }
```

#### `POST /api/share`

**Request:**
```json
{ "jobId": "ckxyz..." }
```

**Response (201):**
```json
{
  "token": "vc_8aZ2...m9X",
  "url": "https://make-cc.app/s/vc_8aZ2...m9X",
  "createdAt": "2026-06-13T10:30:00Z"
}
```

**Public access**: `GET /s/{token}` → 영상 미리보기는 제공하지 않음 (프라이버시), SRT 다운로드만 가능.

### 4.3 Error Response Format

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "오늘의 게스트 처리량을 모두 사용했습니다. 회원가입하시면 30분/1GB까지 처리 가능합니다.",
    "details": { "remainingSec": 0, "resetAt": "2026-06-14T00:00:00Z" }
  }
}
```

### 4.4 Worker Job Spec (BullMQ)

```typescript
// queue: "transcribe"
interface TranscribeJobData {
  jobId: string;
}

// progress callback (0~100) → services.jobs.updateProgress
// Whisper 진행률은 segment 누적/총 길이로 계산
```

---

## 5. UI/UX Design

### 5.1 Page Map

| Path | Purpose | Auth | Notes |
|------|---------|------|-------|
| `/` | 랜딩 + 즉시 업로드 박스 (게스트 시도) | Public | 게스트 캡 안내 |
| `/login` | 이메일 + Google | Public | NextAuth |
| `/upload` | 업로드 진행 + 큐 상태 | Member | 게스트는 `/` |
| `/jobs` | 내 처리 이력 리스트 | Member | 페이지네이션 |
| `/editor/{jobId}` | 영상 + 자막 미리보기/편집 | Owner | SSE 연결 |
| `/s/{token}` | 공유 링크 (SRT 다운로드만) | Public | 영상 미공개 |
| `/account` | 계정 설정 / 영상·자막 삭제 | Member | |

### 5.2 Editor Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 이력으로                                       [SRT 다운로드]  │
├────────────────────────────────────┬─────────────────────────────┤
│                                    │  Cue List (가상 스크롤)      │
│   ┌─────────────────────────┐      │  ┌───────────────────────┐  │
│   │                         │      │  │ 1  00:00.0 → 00:02.4  │  │
│   │      <video> player     │      │  │  안녕하세요.           │  │
│   │                         │      │  ├───────────────────────┤  │
│   └─────────────────────────┘      │  │ 2  00:02.5 → 00:05.8  │◀─ 재생 sync
│                                    │  │  오늘 강의를 시작합니다│  │
│   현재 cue: "안녕하세요."           │  ├───────────────────────┤  │
│                                    │  │ ...                   │  │
├────────────────────────────────────┴─────────────────────────────┤
│  [저장] (자동 저장 5초 디바운스)            상태: 저장됨          │
└──────────────────────────────────────────────────────────────────┘
```

- **영상-자막 동기화**: 영상 currentTime 기준으로 활성 cue 강조, 클릭 시 해당 시각으로 seek
- **편집 범위**: 텍스트만 (타임코드는 readonly, 향후 Phase에서 편집 허용 가능)
- **자동 저장**: 변경 후 5초 디바운스, 실패 시 토스트 + 재시도 버튼
- **접근성**: 키보드 화살표 ↑↓로 cue 이동, Tab/Enter로 편집 시작

### 5.3 Upload Flow (Critical UX)

```
[/ or /upload] 드래그앤드롭 박스
     │
     │ 파일 선택
     ▼
파일 메타 추출 (브라우저 <video> 로드 → duration)
     │
     ├─ 게스트 캡 위반: 인라인 안내 "5분 이내 영상만 게스트로 처리 가능. 회원가입하기"
     │
     ▼ POST /api/uploads/init
[Job 생성 + Presigned URLs 받음]
     │
     ▼ 각 part PUT (병렬 3개) — 진행률 바
     │
     ▼ POST /api/uploads/{uploadId}/complete
[큐잉 완료]
     │
     ▼ SSE 연결 / 폴링
[대기열 위치 표시] → [STT 진행률 0~100%] → [완료]
     │
     ▼ 자동 라우팅 /editor/{jobId}
```

### 5.4 Component List (Option C — features/ 모듈)

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `UploadDropzone` | `src/features/upload/components/` | 드래그앤드롭 + 메타 추출 |
| `useChunkedUpload` | `src/features/upload/hooks/` | 청크 분할·병렬 PUT·재시도 |
| `JobProgress` | `src/features/upload/components/` | 큐 위치 + 진행률 바 |
| `JobStreamProvider` | `src/features/jobs/components/` | SSE 연결 컨텍스트 |
| `EditorLayout` | `src/features/editor/components/` | 영상·cue 리스트 그리드 |
| `VideoPlayer` | `src/features/editor/components/` | `<video>` 래퍼 + currentTime 이벤트 |
| `CueList` | `src/features/editor/components/` | 가상 스크롤 + 활성 cue 강조 |
| `CueEditor` | `src/features/editor/components/` | 인라인 텍스트 편집 |
| `useSubtitleStore` | `src/features/editor/hooks/` | Zustand 상태 (cues + dirty) |
| `useAutoSave` | `src/features/editor/hooks/` | 디바운스 저장 + 결과 토스트 |
| `HistoryTable` | `src/features/history/components/` | 잡 리스트 |
| `ShareLinkCard` | `src/features/share/components/` | 링크 생성·복사·폐기 |
| `GuestCapBanner` | `src/features/upload/components/` | 한도 안내 + 회원가입 CTA |

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | HTTP | Cause | Handling |
|------|:-:|------|----------|
| `INVALID_INPUT` | 400 | Zod 스키마 위반 | 클라이언트가 필드별 메시지 표시 |
| `AUTH_REQUIRED` | 401 | 세션 없음 / 만료 | `/login`으로 리다이렉트 (returnTo 보존) |
| `FORBIDDEN` | 403 | 타 사용자 잡 접근 | 토스트 + `/jobs`로 이동 |
| `NOT_FOUND` | 404 | jobId/token 없음 | 404 페이지 |
| `PAYLOAD_TOO_LARGE` | 413 | 파일/길이 캡 초과 | 인라인 한도 안내 + 회원가입 CTA |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | MIME 비허용 | 지원 포맷 안내 |
| `QUOTA_EXCEEDED` | 429 | 게스트 일일 캡 도달 | 한도 안내 + 다음 리셋 시간 |
| `OVERLAP` | 400 | cue 시간 겹침 | 편집기에서 해당 cue 하이라이트 |
| `WORKER_BUSY` | 503 | 큐 길이 임계치 초과 | "잠시 후 다시 시도" 안내 + 자동 재시도 |
| `STT_FAILED` | 500 | 워커 STT 실패 (재시도 후) | 잡 상태 `failed`, 사용자에게 사유 표시 |
| `INTERNAL` | 500 | 예상치 못한 예외 | 일반 메시지 + 에러 ID |

### 6.2 Error Response Format

```json
{
  "error": {
    "code": "STT_FAILED",
    "message": "자막 생성에 실패했습니다. 다시 시도하거나 문의해주세요.",
    "details": { "jobId": "ckxyz...", "errorId": "err_a1b2c3" }
  }
}
```

### 6.3 Worker Failure Handling

- **재시도**: BullMQ attempts=3, backoff=exponential(30s, 2m, 8m)
- **Dead Letter**: 3회 실패 시 `Job.status='failed'`, `JobEvent{type:'failed', payload:{stage,reason}}` 기록
- **부분 결과 보존**: ffmpeg는 성공했으나 Whisper에서 실패한 경우 wav를 유지하고 워커 재기동 시 단계 스킵
- **GPU 죽음 감지**: 헬스체크(`/healthz` 30s) 실패 시 워커 재시작 + 진행 중 잡 자동 재큐

---

## 7. Security Considerations

- [x] **인증**: NextAuth.js v5 (Email magic link + Google OAuth)
- [x] **세션**: HTTP-only Secure SameSite=Lax 쿠키, 30일 만료
- [x] **인가**: 모든 잡 조회는 `ownerId` 일치 또는 유효한 공유 토큰만
- [x] **게스트 식별**: 서버에서 발급한 `anonymousId` HTTP-only 쿠키 (1년) — XSS 노출 방지
- [x] **입력 검증**: 모든 API는 Zod 스키마(`zod`), MIME 화이트리스트, SRT cue 길이/태그 검증
- [x] **XSS**: SRT 본문은 항상 텍스트로 렌더(`<pre>` 또는 textContent), HTML 금지
- [x] **SQL Injection**: Prisma만 사용, raw query 금지 (linter rule)
- [x] **CSRF**: Auth.js의 CSRF token + SameSite=Lax + API는 같은 origin에서만 호출
- [x] **Presigned URL**: 만료 1시간, PUT 권한만, 파일 크기 제한 헤더
- [x] **Rate Limiting**: `/api/uploads/init`은 IP당 분당 3회, 게스트는 IP+anonymousId 결합
- [x] **R2 보안**: 버킷 공개 금지, 모든 다운로드는 서버 프록시 또는 짧은 만료 presigned
- [x] **PII 최소화**: 영상은 워커 작업 디스크에서 처리 후 즉시 삭제, R2는 lifecycle rule
- [x] **약관**: 영상은 학습에 사용 안 함 + 자동 삭제 정책 명시
- [x] **시크릿**: Vercel Env + Worker는 1Password CLI/AWS Secrets Manager
- [x] **HTTPS**: Vercel 자동, 워커는 reverse proxy(Caddy/Nginx) + Let's Encrypt
- [x] **DDoS**: Cloudflare 프록시 권장 (DNS만 CF, origin은 Vercel)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| Unit | services/* (jobs, subtitles, srt parser, auth guards) | Vitest |
| Unit | 게스트 캡 계산 로직 (DailyGuestUsage) | Vitest |
| Unit | SRT 파서/시리얼라이저 (timecode 변환) | Vitest |
| Integration | API Routes ↔ DB (test DB로 트랜잭션 격리) | Vitest + supertest |
| Integration | Worker ↔ BullMQ ↔ DB ↔ R2(mock) | Vitest |
| Contract | OpenAPI schema vs Zod (선택) | zod-to-openapi |
| E2E | 업로드 → 큐 → 워커(mock STT) → 편집 → 다운로드 | Playwright |
| E2E | 게스트 캡 초과 시 회원가입 유도 | Playwright |
| Manual | 실제 Whisper STT 정확도 (검증 셋 30개) | 사람 평가 (WER) |
| Load | 동시 업로드 10개, 큐 100개 대기 | k6 |

### 8.2 Test Cases (Critical)

- [ ] Happy path: 게스트 3분 영상 업로드 → 자막 다운로드 < 4분 (모의 STT)
- [ ] Happy path: 회원 20분 영상 업로드 → 편집 → 저장 → 공유 링크 생성 → 익명 다운로드
- [ ] Error: 게스트 6분 영상 거부 (인라인 안내)
- [ ] Error: 회원 35분 영상 거부
- [ ] Error: 같은 잡 중복 업로드 완료 호출 (멱등)
- [ ] Error: SSE 연결 끊김 후 재연결(Last-Event-ID)
- [ ] Edge: cue 시간 겹침 입력 → 400 OVERLAP, UI에서 빨간 표시
- [ ] Edge: 워커 다운 후 재기동 → 진행 중 잡 자동 재큐
- [ ] Edge: 공유 링크 폐기 후 접근 → 404
- [ ] Security: 타 사용자 잡 GET → 403
- [ ] Security: SRT에 `<script>` 포함 시도 → 텍스트 이스케이프 확인
- [ ] Privacy: 게스트 잡 다운로드 후 1시간 내 R2 영상 키 부재

---

## 9. Clean Architecture (Option C 매핑)

### 9.1 Layer Structure (Pragmatic Modular)

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI components, hooks, pages | `src/app/`, `src/features/*/components/`, `src/features/*/hooks/` |
| **Application** | 도메인 서비스, 트랜잭션 경계 | `src/services/*` |
| **Domain** | Entity types, 비즈니스 규칙(순수 함수) | `src/types/`, `src/lib/srt.ts` |
| **Infrastructure** | DB, Redis, R2, Resend, Whisper 호출 | `src/lib/db.ts`, `lib/redis.ts`, `lib/r2.ts`, `lib/resend.ts`, `lib/whisper.ts` (worker) |

### 9.2 Dependency Rules

```
Presentation (app, features) ─→ Application (services)
                                       │
                                       ▼
                              Infrastructure (lib)
                                       │
                                       ▼
                                 Domain (types, srt 순수 로직)
```

- Presentation은 services를 호출하고 lib을 직접 import하지 않는다 (예외: `lib/auth/session.ts` 같은 readonly helper)
- Worker도 Presentation 없이 services + lib만 사용

### 9.3 File Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| `app/` (route handlers) | `services/*`, `types/*`, `lib/auth`, `lib/env` | `lib/r2`, `lib/db` (services 통해서만) |
| `features/*` (UI) | `types/*`, server actions (services 호출), `lib/api` 클라이언트 | `lib/db`, `lib/r2` (서버 전용) |
| `services/*` | `lib/*`, `types/*`, 다른 service | `app/`, `features/`, React 의존 |
| `lib/*` | 외부 패키지, `types/*` | `services/`, `app/`, `features/` |
| `types/*` | 외부 패키지 (zod 등) | 모두 |
| `worker/` | `services/*`, `lib/*`, `types/*` | `app/`, `features/` (React) |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `UploadDropzone`, `CueList`, `EditorLayout` | Presentation | `src/features/{upload,editor}/components/` |
| `useChunkedUpload`, `useSubtitleStore`, `useAutoSave` | Presentation (hooks) | `src/features/*/hooks/` |
| `JobService` (create/transition/list) | Application | `src/services/jobs/service.ts` |
| `SubtitleService` (load/save/serialize) | Application | `src/services/subtitles/service.ts` |
| `StorageService` (R2 multipart) | Application | `src/services/storage/service.ts` |
| `QueueService` (enqueue/poll) | Application | `src/services/queue/service.ts` |
| `NotifyService` (Resend) | Application | `src/services/notify/service.ts` |
| `AuthGuards` (게스트 캡 / 회원 캡) | Application | `src/services/auth/guards.ts` |
| `Job`, `JobStatus`, `Cue`, `ShareLink` | Domain | `src/types/` |
| `srt.parse`, `srt.build`, `timecode 변환` | Domain | `src/lib/srt.ts` (순수 함수) |
| `prisma client` | Infrastructure | `src/lib/db.ts` |
| `redisClient`, BullMQ Queue/Worker | Infrastructure | `src/lib/redis.ts` |
| `r2Client`, `presignMultipart` | Infrastructure | `src/lib/r2.ts` |
| `resend client` | Infrastructure | `src/lib/resend.ts` |
| `whisperRun` (Python child_process) | Infrastructure (worker only) | `worker/lib/whisper.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `UploadDropzone`, `CueList` |
| Functions/Variables | camelCase | `enqueueTranscribe()`, `currentCueIndex` |
| Constants | UPPER_SNAKE_CASE | `GUEST_DURATION_LIMIT_SEC`, `PART_SIZE_BYTES` |
| Types/Interfaces | PascalCase, prefix 없음 | `Job`, `Cue`, `JobStatus` |
| Files (component) | PascalCase.tsx | `UploadDropzone.tsx` |
| Files (utility) | camelCase.ts | `srt.ts`, `timecode.ts` |
| Folders | kebab-case | `features/upload/`, `services/jobs/` |
| API routes | kebab-case 폴더 + `route.ts` | `app/api/uploads/init/route.ts` |
| DB tables | snake_case 복수형 | `jobs`, `job_events`, `share_links` |
| Enum values | snake_case 또는 lowercase | `'transcribing'`, `'user'` |

### 10.2 Import Order

```typescript
// 1. External
import { NextResponse } from 'next/server';
import { z } from 'zod';

// 2. Internal absolute (@/)
import { jobsService } from '@/services/jobs';
import { requireSession } from '@/services/auth';
import type { Job } from '@/types/job';

// 3. Relative
import { uploadInitSchema } from './schema';

// 4. Styles
import './styles.css';
```

### 10.3 Environment Variables Naming

| Prefix | Purpose | Scope |
|--------|---------|-------|
| `NEXT_PUBLIC_` | 클라이언트 노출 | Browser (예: `NEXT_PUBLIC_APP_URL`) |
| `DATABASE_` / `REDIS_` | 인프라 연결 | Server only |
| `AUTH_` | NextAuth | Server only |
| `R2_` | Cloudflare R2 | Server + Worker |
| `RESEND_` | 이메일 | Server only |
| `WHISPER_` | 워커 설정 | Worker only |
| `GUEST_` | 게스트 정책 | Server only |

모든 env는 `src/lib/env.ts`에서 Zod로 검증 후 export, 직접 `process.env` 사용 금지.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| 컴포넌트 명명 | `{도메인}{역할}` 형태 (`UploadDropzone`, `CueEditor`) |
| 파일 구조 | `features/` 도메인 폴더 안 `components/`, `hooks/`, `index.ts` |
| 상태 관리 | 클라이언트 폼·편집기 상태는 Zustand, 서버 상태는 TanStack Query |
| 에러 처리 | API: `apiError(code, message, status, details)` 헬퍼로 표준 응답 / Service: 도메인 에러 클래스 throw |
| 로깅 | `lib/logger.ts` (pino) — 모든 API는 requestId 포함 |
| 트랜잭션 | `services/jobs`처럼 여러 테이블 변경이 있는 경우 `prisma.$transaction` 명시 |
| 멱등성 | upload `complete`는 `Job.status` 검사로 멱등, 큐 enqueue는 jobId를 BullMQ jobId로 사용 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
make_cc/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx                       # 랜딩 + 즉시 업로드
│   │   │   └── pricing/page.tsx               # (선택)
│   │   ├── (app)/
│   │   │   ├── upload/page.tsx
│   │   │   ├── jobs/page.tsx
│   │   │   ├── editor/[jobId]/page.tsx
│   │   │   └── account/page.tsx
│   │   ├── s/[token]/page.tsx                 # 공유 링크 공개 페이지
│   │   ├── api/
│   │   │   ├── uploads/
│   │   │   │   ├── init/route.ts
│   │   │   │   └── [uploadId]/
│   │   │   │       ├── complete/route.ts
│   │   │   │       └── abort/route.ts
│   │   │   ├── jobs/
│   │   │   │   ├── route.ts                   # GET 이력
│   │   │   │   └── [jobId]/
│   │   │   │       ├── route.ts               # GET 단건
│   │   │   │       ├── stream/route.ts        # SSE
│   │   │   │       └── cancel/route.ts
│   │   │   ├── subtitles/[jobId]/
│   │   │   │   ├── route.ts                   # GET/PUT
│   │   │   │   └── download/route.ts
│   │   │   ├── share/
│   │   │   │   ├── route.ts                   # POST 생성
│   │   │   │   └── [token]/route.ts           # GET/DELETE
│   │   │   └── auth/[...nextauth]/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── features/
│   │   ├── upload/
│   │   │   ├── components/{UploadDropzone,JobProgress,GuestCapBanner}.tsx
│   │   │   ├── hooks/useChunkedUpload.ts
│   │   │   └── index.ts
│   │   ├── editor/
│   │   │   ├── components/{EditorLayout,VideoPlayer,CueList,CueEditor}.tsx
│   │   │   ├── hooks/{useSubtitleStore,useAutoSave,useVideoSync}.ts
│   │   │   └── index.ts
│   │   ├── history/components/HistoryTable.tsx
│   │   └── share/components/ShareLinkCard.tsx
│   ├── services/
│   │   ├── jobs/{service.ts,events.ts,index.ts}
│   │   ├── subtitles/{service.ts,index.ts}
│   │   ├── storage/{service.ts,multipart.ts,index.ts}
│   │   ├── queue/{service.ts,index.ts}
│   │   ├── notify/{service.ts,templates.ts,index.ts}
│   │   └── auth/{guards.ts,session.ts,index.ts}
│   ├── lib/
│   │   ├── db.ts                              # Prisma client (singleton)
│   │   ├── redis.ts                           # ioredis + BullMQ Queue
│   │   ├── r2.ts                              # S3 client + multipart helpers
│   │   ├── resend.ts
│   │   ├── srt.ts                             # 순수 함수 (parse/build)
│   │   ├── timecode.ts                        # ms ↔ "HH:MM:SS,mmm"
│   │   ├── env.ts                             # zod-validated env
│   │   ├── logger.ts                          # pino
│   │   └── api.ts                             # apiError, apiOk 헬퍼
│   └── types/
│       ├── job.ts
│       ├── subtitle.ts
│       └── share.ts
├── worker/
│   ├── index.ts                               # BullMQ Worker bootstrap
│   ├── transcribe.ts                          # job handler (services 재사용)
│   ├── lib/
│   │   ├── ffmpeg.ts                          # child_process ffmpeg
│   │   └── whisper.ts                         # Python 호출 + progress 파싱
│   ├── scripts/whisper.py
│   ├── Dockerfile                             # CUDA + Whisper
│   └── package.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── e2e/ (Playwright)
│   └── unit/ (Vitest, services/lib)
├── .env.example
├── CLAUDE.md                                  # 신규 작성
├── package.json
├── tsconfig.json
└── next.config.ts
```

### 11.2 Implementation Order

1. [ ] **부트스트랩**: Next.js 15 init, TypeScript strict, ESLint/Prettier, Tailwind, shadcn/ui
2. [ ] **인프라 클라이언트**: `lib/env.ts`, `lib/db.ts`, `lib/redis.ts`, `lib/r2.ts`, `lib/resend.ts`, `lib/logger.ts`
3. [ ] **DB 마이그레이션**: Prisma schema 작성 → `prisma migrate dev`
4. [ ] **인증**: NextAuth.js v5 + Google + Email magic link, 게스트 anonymousId 미들웨어
5. [ ] **도메인 라이브러리**: `lib/srt.ts`, `lib/timecode.ts` + 단위 테스트
6. [ ] **services 레이어**: jobs / storage / queue / subtitles / notify / auth.guards
7. [ ] **API Routes**: uploads → jobs → subtitles → share 순서, 각 라우트에 Zod 검증
8. [ ] **워커 부트스트랩**: worker package, BullMQ Worker, ffmpeg + Whisper Python 스크립트 통합
9. [ ] **워커 단위 테스트**: 모의 영상 → SRT 생성 확인
10. [ ] **UI features**: upload → editor → history → share (각각 services 호출하는 server actions)
11. [ ] **SSE 구현**: `/api/jobs/{jobId}/stream` + 클라이언트 EventSource 훅
12. [ ] **랜딩 페이지** + 게스트 캡 안내
13. [ ] **E2E**: Playwright 핵심 시나리오 4개
14. [ ] **운영 도구**: 헬스체크, 로그 대시보드, R2 lifecycle rule 적용
15. [ ] **약관·개인정보처리방침** 작성
16. [ ] **배포**: Vercel(웹) + GPU 노드(Docker Compose)

### 11.3 Session Guide

> Auto-generated. Use `/pdca do video-auto-caption --scope module-N` for incremental implementation.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Bootstrap & Infra | `module-1` | Next.js init, TS/ESLint/Tailwind/shadcn, `lib/env.ts`, `lib/db.ts`, `lib/redis.ts`, `lib/r2.ts`, `lib/logger.ts`, Prisma schema + 첫 migration | 25-30 |
| Auth & Guest | `module-2` | NextAuth(Email + Google), session helpers, anonymousId 미들웨어, `services/auth/guards.ts` (게스트 캡 + 회원 캡) | 20-25 |
| Domain Lib | `module-3` | `lib/srt.ts`, `lib/timecode.ts`, `types/*`, 단위 테스트 (SRT 파서) | 15-20 |
| Jobs & Storage Services | `module-4` | `services/jobs`, `services/storage` (R2 multipart), `services/queue` (BullMQ), 잡 상태 머신 | 30-35 |
| Upload & Job APIs | `module-5` | `/api/uploads/init`, `/api/uploads/[uploadId]/complete`, `/api/jobs/*`, SSE 엔드포인트 | 30-35 |
| Worker | `module-6` | `worker/` 패키지, BullMQ Worker, ffmpeg + Whisper(Python) 통합, Dockerfile, 모의 STT로 E2E | 30-40 |
| Subtitle APIs & Notify | `module-7` | `/api/subtitles/*`, `services/notify` (Resend), 완료 이메일 템플릿 | 20-25 |
| Upload UI | `module-8` | Landing + 게스트 드래그앤드롭 + 청크 업로드 훅 + 진행률 + 게스트 캡 배너 | 25-30 |
| Editor UI | `module-9` | EditorLayout, VideoPlayer, CueList(가상 스크롤), 인라인 편집, 자동 저장, 영상-자막 sync | 35-40 |
| History & Share UI | `module-10` | 회원 이력 페이지, 공유 링크 생성·폐기, `/s/[token]` 공개 페이지 | 20-25 |
| QA & Deploy | `module-11` | Playwright E2E 4개, R2 lifecycle rule, 약관 페이지, Vercel 배포 + 워커 Docker Compose | 25-30 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 30-35 (완료) |
| Session 2 | Do | `--scope module-1,module-2` | 45-55 |
| Session 3 | Do | `--scope module-3,module-4` | 45-55 |
| Session 4 | Do | `--scope module-5,module-7` | 50-60 |
| Session 5 | Do | `--scope module-6` (워커 — 환경 의존, 별도 세션) | 30-40 |
| Session 6 | Do | `--scope module-8,module-9` | 60-70 |
| Session 7 | Do | `--scope module-10,module-11` | 45-55 |
| Session 8 | Check + Report | 전체 | 30-40 |

**병목 식별**: Session 5(워커)는 GPU 환경 의존이라 PoC 영상 1~2개로 검증 후 별도 진행 권장. Session 6(에디터 UI)이 가장 복잡 — `--scope module-9` 단독 분리 가능.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-13 | Initial draft (Option C 채택, 데이터 모델·API·UI·테스트 1차 확정) | shong7500 |
