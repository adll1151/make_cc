# make_cc — AI Coding Agent 가이드

> 이 파일은 Claude Code 같은 AI 코딩 에이전트가 이 저장소에서 일관된 결정을 내리도록 돕는 컨텍스트 문서입니다.

## 프로젝트 개요

한국어 영상을 업로드하면 self-hosted Whisper(ko)로 **CC(Closed Caption · 폐쇄형 자막)** 를 자동 생성하고,
브라우저에서 미리보기·편집·공유까지 가능한 풀스택 웹 서비스.

**CC**란 영상에 박힌 burn-in이 아니라 켜고/끌 수 있는 표준 자막(SRT/VTT)을 말합니다.

- **Plan**: `docs/01-plan/features/video-auto-caption.plan.md`
- **Design**: `docs/02-design/features/video-auto-caption.design.md`
- **아키텍처**: Option C (Pragmatic Modular) — `features/` UI + `services/` 도메인 + `lib/` 인프라

## 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) + TS strict | Vercel 배포 |
| Auth | **Supabase Auth** | 이메일 매직 링크 + OAuth |
| DB | **Supabase Postgres** | RLS로 권한 강제 |
| Storage | **Supabase Storage** | private 버킷 + signed URL |
| 큐 | BullMQ + Redis | STT 잡 분산 |
| STT | Self-host Whisper (large-v3, ko) | GPU 노드 (별도 워커) |
| UI | Tailwind + shadcn/ui + Zustand + TanStack Query | |
| Email 알림 | Resend | 잡 완료 알림 |
| 테스트 | Vitest + Playwright | |

## 디렉터리 규칙

```
src/
  app/                  Next.js App Router (route handlers, pages)
  features/             UI 모듈 (upload, editor, history, share)
  services/             도메인 로직 (jobs, subtitles, storage, queue, notify, auth)
  lib/                  인프라 클라이언트
    supabase/           server.ts, browser.ts, admin.ts, database.types.ts
    storage.ts          Supabase Storage 헬퍼
    redis.ts            ioredis + BullMQ
    resend.ts           이메일
    env.ts              Zod 검증된 환경변수
    api.ts              apiOk / apiError / AppError / handleApiError
    logger.ts           pino
    utils.ts            cn (shadcn)
  components/ui/        shadcn/ui 원자 컴포넌트
  types/                도메인 타입 (Job, Cue, ShareLink ...)
worker/                 GPU 노드에서 실행되는 별도 패키지 (services/ 재사용)
supabase/migrations/    SQL 마이그레이션
tests/                  vitest 단위·통합 / playwright e2e
docs/                   PDCA 문서
```

## 임포트 경계 (ESLint로 강제)

| Layer | 허용 | 금지 |
|-------|------|------|
| `app/` route handlers | `services/*`, `types/*`, `lib/env`, `lib/api`, `lib/supabase/server` | `lib/supabase/admin`, `lib/storage`, `lib/redis`, `lib/resend` 직접 |
| `features/*` UI | `types/*`, `lib/supabase/browser`, server actions | 서버 전용 인프라 |
| `services/*` | `lib/*`, `types/*`, 다른 service | React, `app/`, `features/` |
| `lib/*` | 외부 패키지, `types/*` | `services/`, `app/`, `features/` |
| `types/*` | zod 등 | 모든 내부 |

핵심 원칙: **얇은 컨트롤러, 두꺼운 서비스.** API Route는 검증·인증·응답만, 비즈니스 로직은 `services/`에 둔다.

## Supabase 클라이언트 선택

| 위치 | 사용 클라이언트 | 권한 |
|------|----------------|------|
| Server Component / Route Handler / Server Action | `createServerSupabase()` | 사용자 컨텍스트 (RLS 적용) |
| 'use client' Component | `createBrowserSupabase()` | 사용자 컨텍스트 |
| 워커, 큐 잡 핸들러, 시스템 관리 작업 | `createAdminClient()` | service_role (RLS 우회) |

게스트 잡 생성·게스트 캡 카운터 등 RLS로 표현하기 어려운 시스템 작업은 `createAdminClient()` 사용.

## 네이밍

- 컴포넌트: PascalCase (`UploadDropzone.tsx`)
- 함수/변수: camelCase
- 파일(유틸): camelCase (`srt.ts`)
- 폴더: kebab-case (`features/upload/`)
- DB 테이블: snake_case 복수형 (`jobs`, `job_events`)
- 환경변수: `lib/env.ts`에서 Zod 검증 후 export. **`process.env` 직접 사용 금지** (단, middleware 등 env import 불가 위치는 예외).

## 에러 처리

- API 응답은 `lib/api.ts`의 `apiError(code, message, status, details?)` / `apiOk(data)` 사용
- Service에서는 `AppError` 클래스 throw
- Route에서 catch 후 `handleApiError`로 표준 응답 변환
- 모든 요청은 `requestId`(pino 로그) 포함

## 잡 상태 머신 (Design §3.1)

```
pending → uploading → queued → transcribing → finished | failed | cancelled
```

전이는 `services/jobs/service.ts`에서만 수행. 직접 update로 status 변경 금지.
모든 전이는 append-only `job_events` 기록.

## CC 출력 정책

- **표준 출력**: SRT 파일 다운로드 (Closed Caption 표준)
- **미리보기**: 브라우저 내 `<video>` + 자막 오버레이 (편집기)
- **편집 결과 저장**: SRT 텍스트는 Supabase Storage `subtitles` 버킷에 저장
- **공유**: 회원이 공유 토큰 생성 → 익명 다운로드 가능
- **MVP 비포함**: burn-in MP4, VTT, 다국어 (Phase 2+)

## 로컬 개발

```powershell
# 1. 의존성
npm install

# 2. Redis (BullMQ용)
docker compose up -d   # Docker 있으면
# 또는 Upstash 무료 티어를 REDIS_URL에 연결

# 3. Supabase 프로젝트 준비
#    - https://supabase.com 에서 프로젝트 생성
#    - Settings → API의 URL/anon key/service_role 복사
#    - SQL Editor에 supabase/migrations/*.sql 순차 실행
#    - Auth → URL Configuration: http://localhost:3000/auth/callback 추가
#    - Storage에 'videos', 'subtitles' 버킷 (마이그레이션이 생성하지만 확인)

# 4. 환경변수
Copy-Item .env.example .env
# Supabase URL/anon key/service_role 채우기

# 5. 타입 생성 (선택, supabase CLI 필요)
npm run db:gen-types

# 6. 개발 서버
npm run dev
# → http://localhost:3000
```

## 테스트

- `npm test` — Vitest (단위·통합)
- Supabase는 mock으로 단위 테스트 (RLS 실제 검증은 별도 통합 테스트에서)

## 보안 기본기

- 모든 사용자 입력은 Zod 검증
- SRT 본문은 텍스트로만 렌더 (XSS 방어)
- 잡·자막 접근은 RLS + 앱 레이어 이중 검증
- 게스트 식별은 HTTP-only `mcc_anon` 쿠키
- service_role 키는 절대 클라이언트 노출 금지

## PDCA 워크플로

이 프로젝트는 bkit PDCA 사이클로 관리됩니다. 현재 단계는 `.bkit/state/pdca-status.json` 참조.

- 모듈 단위 구현: `/pdca do video-auto-caption --scope module-N`
- 갭 분석: `/pdca analyze video-auto-caption`
- 보고서: `/pdca report video-auto-caption`
