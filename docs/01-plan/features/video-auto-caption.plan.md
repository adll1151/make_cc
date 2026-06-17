---
template: plan
version: 1.3
feature: video-auto-caption
date: 2026-06-13
author: shong7500
project: make_cc
status: Draft
---

# video-auto-caption Planning Document

> **Summary**: 사용자가 영상을 업로드하면 self-hosted Whisper로 한국어 음성을 인식해 SRT 자막을 자동 생성하고, 미리보기·편집·공유 링크를 제공하는 웹 서비스
>
> **Project**: make_cc
> **Version**: 0.1.0
> **Author**: shong7500
> **Date**: 2026-06-13
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 한국어 영상에 CC 자막을 수동으로 다는 작업은 1시간 영상 기준 평균 4~6시간이 걸리며, 전문 자막 도구 구입·학습 비용이 부담된다 |
| **Solution** | 영상 업로드 → ffmpeg 음성 추출 → self-hosted Whisper(ko) STT → SRT 생성 → 브라우저 내 자막 편집기 → 다운로드·공유 링크 (비동기 처리 + 완료 알림) |
| **Function/UX Effect** | 게스트는 회원가입 없이 5분 영상까지 즉시 체험, 회원은 30분/1GB까지 처리하며 미리보기·편집·이력·공유 링크 제공. 처리 중 화면 이탈 가능 |
| **Core Value** | 한국어 영상 CC 자막을 5분 안에 자동 생성·편집·공유 — 비용은 서버 GPU 운영비뿐, 사용자 비용 0원 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 한국어 영상 자막 작성의 수동 작업 부담(영상 시간 대비 4~6배 소요)을 자동화로 해소 |
| **WHO** | 한국어 콘텐츠 크리에이터, 영상 편집자, 접근성 의무가 있는 퍼블리셔 (1차) / 게스트 체험 사용자 (유입) |
| **RISK** | GPU 자원 비용·대기열 폭주 / 자막 정확도(특히 고유명사·전문용어) / 영상 데이터 프라이버시 |
| **SUCCESS** | 5분 영상 평균 자막 생성 시간 ≤ 3분, 자막 WER(Word Error Rate) ≤ 15%, 게스트→회원 전환율 ≥ 10% |
| **SCOPE** | Phase 1: 업로드→자막 생성→다운로드 (게스트 포함) / Phase 2: 미리보기·편집기 / Phase 3: 회원 이력·공유 링크 |

---

## 1. Overview

### 1.1 Purpose

한국어 영상에 CC(Closed Caption) 자막을 다는 작업을 자동화하여, 콘텐츠 크리에이터가 영상 제작 본연의 작업에 집중할 수 있도록 하는 웹 서비스를 구축한다.

### 1.2 Background

- **시장 상황**: 유튜브·인스타 릴스·틱톡 등 숏폼·롱폼 영상 콘텐츠가 폭증하면서 CC 자막 수요가 급증
- **기존 솔루션의 한계**: 상용 도구(VREW, Subtitle Edit 등)는 결제·학습 부담, 무료 도구는 한국어 정확도 낮음
- **기술적 가능성**: OpenAI Whisper의 한국어 인식 품질이 상용 수준에 도달, self-host로 비용 최소화 가능
- **차별화 포인트**: 회원가입 없이 즉시 체험 가능 + 한국어 특화 후처리(맞춤법·문장부호) + 공유 링크

### 1.3 Related Documents

- PRD: (없음 — `/pdca pm` 미실행)
- 참고: OpenAI Whisper https://github.com/openai/whisper
- 자막 포맷 표준: SRT (SubRip Text)

---

## 2. Scope

### 2.1 In Scope (MVP)

- [ ] 영상 파일 업로드 (드래그앤드롭 + 파일 선택)
- [ ] 게스트 모드: 5분/200MB 영상 1회 처리
- [ ] 회원 모드: 30분/1GB 영상, 이력 저장
- [ ] 회원가입·로그인 (이메일/소셜 1종)
- [ ] ffmpeg 기반 음성 추출
- [ ] self-hosted Whisper(ko) STT 처리
- [ ] SRT 자막 파일 생성
- [ ] 비동기 처리 + 완료 알림 (이메일 또는 브라우저 푸시)
- [ ] 브라우저 내 자막 미리보기 (영상 + 자막 오버레이)
- [ ] 브라우저 내 자막 텍스트 편집 (타임코드 유지)
- [ ] 편집 후 SRT 다운로드
- [ ] 처리 결과 공유 링크 (영구·익명 다운로드 가능)
- [ ] 회원 이력 페이지 (최근 처리 영상 리스트)
- [ ] 처리 큐 상태 표시 (대기열 N번째)

### 2.2 Out of Scope (MVP 제외 — Phase 2+)

- 영어·다국어 자막 (Whisper 다국어는 인프라 정착 후)
- 자막 burn-in 영상 출력 (FFmpeg 영상 인코딩 추가 부담)
- 화자 분리(diarization)
- 자막 스타일(폰트/색상) 설정
- 실시간 자막
- 모바일 앱
- 결제·구독 모델
- 팀 협업 / 권한 분리
- 영상 편집 기능 (컷·트림)
- API 외부 제공

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 사용자는 영상 파일(mp4/mov/mkv/webm)을 업로드할 수 있다 | High | Pending |
| FR-02 | 게스트는 5분/200MB 이하 영상 1회만 처리 가능 (세션 기준) | High | Pending |
| FR-03 | 회원은 30분/1GB 이하 영상을 처리 가능 | High | Pending |
| FR-04 | 회원가입은 이메일 + 소셜 로그인 1종(예: Google)을 지원 | High | Pending |
| FR-05 | 영상 업로드 후 음성을 추출하고 Whisper(ko)로 STT를 수행한다 | High | Pending |
| FR-06 | 처리 결과는 SRT 포맷으로 생성된다 | High | Pending |
| FR-07 | 처리는 비동기로 실행되며, 사용자는 화면을 떠나도 된다 | High | Pending |
| FR-08 | 처리 완료 시 이메일(또는 브라우저 푸시)로 알림 | High | Pending |
| FR-09 | 사용자는 영상 + 자막을 함께 미리보기 할 수 있다 | High | Pending |
| FR-10 | 사용자는 자막 텍스트를 라인 단위로 편집할 수 있다 (타임코드는 유지) | High | Pending |
| FR-11 | 사용자는 편집된 SRT를 다운로드할 수 있다 | High | Pending |
| FR-12 | 회원은 처리 결과에 대한 영구 공유 링크를 생성할 수 있다 | High | Pending |
| FR-13 | 공유 링크 접근자는 회원가입 없이 SRT를 다운로드할 수 있다 | High | Pending |
| FR-14 | 회원은 자신의 최근 처리 이력을 조회할 수 있다 | Medium | Pending |
| FR-15 | 처리 큐 진행 상태(대기 N번째 / 진행률)를 사용자에게 표시 | Medium | Pending |
| FR-16 | 회원은 자신의 영상·자막을 삭제할 수 있다 | Medium | Pending |
| FR-17 | 업로드 영상은 처리 완료 후 N일 뒤 자동 삭제 (게스트 즉시, 회원 30일) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|--------------------|
| **Performance** | 5분 영상 평균 처리 시간 ≤ 3분 (대기열 제외) | 처리 큐 로그 + p50/p95 측정 |
| **Performance** | 자막 정확도 WER ≤ 15% (한국어 일반 음성) | 검증용 데이터셋 30개 평가 |
| **Scalability** | 동시 처리 큐 ≥ 5개, 대기열 100개까지 무중단 | 부하 테스트(k6) |
| **Availability** | 가용성 ≥ 99% (월 다운타임 ≤ 7시간) | UptimeRobot 모니터링 |
| **Security** | OWASP Top 10 준수, 업로드 파일 MIME 검증 | OWASP ZAP 스캔 |
| **Privacy** | 영상 데이터는 사용자 동의 없이 학습·외부 전송 금지, 자동 삭제 정책 명시 | 개인정보처리방침 + 코드 리뷰 |
| **Accessibility** | WCAG 2.1 AA (자막 편집 UI 키보드 접근) | axe-core + 수동 검증 |
| **Resource** | GPU 메모리 ≤ 8GB (Whisper large-v3 기준) | nvidia-smi 모니터링 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01 ~ FR-13 모두 구현 완료 (Core Path)
- [ ] FR-14 ~ FR-17 구현 완료 (Member features)
- [ ] 모든 API에 통합 테스트 작성
- [ ] STT 파이프라인에 E2E 테스트 (샘플 영상 → SRT 검증)
- [ ] 코드 리뷰 완료
- [ ] 개인정보처리방침·이용약관 작성
- [ ] 운영 매뉴얼 작성 (GPU 서버 재시작, 큐 모니터링)

### 4.2 Quality Criteria

- [ ] 자막 정확도 WER ≤ 15% (30개 검증 셋 평균)
- [ ] 5분 영상 처리 시간 p95 ≤ 5분
- [ ] 빌드·린트 0 에러
- [ ] 핵심 모듈 테스트 커버리지 ≥ 70%
- [ ] Lighthouse Performance ≥ 80, Accessibility ≥ 90

### 4.3 Business Criteria (관찰용)

- [ ] 게스트→회원 전환율 ≥ 10% (출시 후 1개월)
- [ ] 1주 단위 처리 영상 ≥ 100건 (출시 후 1개월)
- [ ] 공유 링크 클릭률 (생성 대비 클릭 비율) 측정

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **GPU 비용 폭증** (대기열 폭주 → GPU 증설) | High | Medium | 게스트 일일 처리량 글로벌 캡 / 회원도 일일 처리량 제한 / 대기열 길이 모니터링 알림 |
| **자막 정확도가 기대보다 낮음** | High | Medium | Whisper large-v3 사용 / 한국어 후처리(맞춤법, 문장부호) / 편집기로 사용자 보완 / 정확도 측정 셋 도입 |
| **악성/불법 영상 업로드** | High | Medium | 약관 명시 / DMCA 신고 채널 / 자동 삭제 정책 / 업로드 시 IP·계정 로깅 |
| **영상 프라이버시 우려로 사용자 이탈** | Medium | High | 자동 삭제 정책 사용자 화면 명시 / 처리 후 N일 자동 삭제 / 학습에 사용 안 함을 약관에 명시 |
| **self-host Whisper 인프라 운영 부담** | Medium | High | Docker 이미지로 표준화 / Phase 1은 단일 GPU 서버 / 큐는 Redis BullMQ 단순 구성 |
| **대용량 영상 업로드 실패** | Medium | Medium | 청크/멀티파트 업로드 / 재개 가능한 업로드 / 진행률 표시 |
| **이메일 알림 전달 지연/실패** | Low | Medium | Resend/SES 사용 / 브라우저 푸시 백업 / 이력 페이지에서 항상 확인 가능 |
| **소셜 로그인 OAuth 키 유출** | High | Low | env 분리 / 시크릿 매니저 / 키 회전 절차 문서화 |

---

## 6. Impact Analysis

> **Note**: Greenfield 프로젝트 — 변경할 기존 리소스 없음. 신규 리소스 도입에 집중.

### 6.1 Changed/New Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `users` | DB Table (New) | 이메일/소셜 식별자, 회원 등급, 가입일 |
| `jobs` | DB Table (New) | 처리 작업 메타(상태, 큐 위치, 진행률, 결과 파일 경로) |
| `videos` | Object Storage (New) | 원본 영상 임시 저장 (자동 삭제) |
| `subtitles` | Object Storage (New) | SRT 파일 저장 (회원: 30일, 게스트: 다운로드 후 즉시) |
| `share_links` | DB Table (New) | 공유 토큰 → job 매핑, 익명 다운로드 권한 |
| `notifications` | DB Table (New) | 이메일 발송 이력, 재시도 상태 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| (없음) | — | Greenfield — 기존 소비자 없음 | None |

### 6.3 Verification

- [x] Greenfield 프로젝트 확인 — 깨질 기존 코드 없음
- [ ] DB 스키마 마이그레이션 도구 선정 후 초기 마이그레이션 검증
- [ ] 객체 스토리지 자동 삭제 정책(TTL/lifecycle rule) 테스트

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites, portfolios | ☐ |
| **Dynamic** | Feature-based modules, BaaS or 가벼운 서버 | Web apps with backend, SaaS MVPs | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems | ☐ |

**선정 사유**: 회원 인증·DB·파일 업로드·비동기 큐가 필요한 풀스택 웹 앱이지만, MVP 단계라 단일 서버 + 워커 분리 정도면 충분. 단, STT 워커는 GPU 노드로 분리하여 운영. (Enterprise 수준의 마이크로서비스는 트래픽 검증 후 검토)

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / Remix / Vite+SPA | **Next.js (App Router)** | 풀스택 단일 코드베이스, API Routes, 파일 업로드 처리 용이 |
| Language | TypeScript / JavaScript | **TypeScript** | DB 스키마·API 타입 일관성 |
| State Management | Context / Zustand / Redux | **Zustand** | 자막 편집기 클라이언트 상태 단순 관리 |
| API Client | fetch / axios / react-query | **TanStack Query (react-query)** | 잡 상태 폴링·캐싱·재시도 표준화 |
| Form Handling | react-hook-form / native | **react-hook-form** | 로그인·회원가입·자막 편집 폼 일관성 |
| Styling | Tailwind / CSS Modules | **Tailwind CSS** | MVP 속도, 디자인 토큰 관리 |
| UI Components | shadcn/ui / MUI / 커스텀 | **shadcn/ui** | 접근성 기본 준수, 커스터마이즈 자유 |
| DB | PostgreSQL / MySQL / SQLite | **PostgreSQL** | 트랜잭션, JSON 컬럼(자막 메타), 운영 도구 풍부 |
| ORM | Prisma / Drizzle / Kysely | **Prisma** | 마이그레이션·타입 안전성 |
| Auth | NextAuth.js / Lucia / Clerk | **NextAuth.js (Auth.js v5)** | 이메일 + Google 소셜, 무료, 셀프 호스트 |
| Storage | S3 / R2 / MinIO | **Cloudflare R2** | 무료 egress, 저비용, S3 호환 |
| Queue | BullMQ / RabbitMQ / SQS | **BullMQ (Redis)** | Node 친화, 진행률·재시도·우선순위 기본 제공 |
| STT | Whisper API / **self-host Whisper** / Naver | **self-host Whisper (large-v3)** | 사용자 비용 0원 정책 / 한국어 품질 우수 / 데이터 외부 전송 없음 |
| Video Processing | ffmpeg (CLI) | **ffmpeg (server)** | 음성 추출(16kHz wav) 표준 |
| Notification | Resend / SES / SendGrid | **Resend** | 무료 티어 충분, DX 우수 |
| Testing | Jest / Vitest / Playwright | **Vitest + Playwright** | 단위(Vitest) + E2E(Playwright) |
| Deployment | Vercel / Self-host / Fly.io | **Hybrid: Vercel(웹) + Self-host GPU 노드(워커)** | 웹은 Vercel, GPU 워커는 자체 서버(예: 집·임대) |

### 7.3 Clean Architecture Approach (Dynamic Level)

```
Selected Level: Dynamic

Folder Structure Preview:
┌─────────────────────────────────────────────────────────────┐
│ src/                                                        │
│   app/                  Next.js App Router (pages, routes)  │
│     (marketing)/        랜딩, 가격, 이용약관                  │
│     (app)/              로그인 후 영역 (업로드, 이력, 편집)   │
│     api/                                                    │
│       upload/           영상 업로드 (멀티파트)                │
│       jobs/             잡 생성·조회·취소                     │
│       subtitles/        SRT 다운로드·편집 저장                │
│       share/            공유 링크 조회                        │
│       auth/             NextAuth handler                    │
│   features/                                                 │
│     upload/             업로드 UI + 청크 로직                 │
│     editor/             자막 편집기 (영상+SRT)                │
│     history/            처리 이력                             │
│     share/              공유 링크 페이지                      │
│   services/                                                 │
│     stt/                Whisper 워커 클라이언트               │
│     storage/            R2 업로드/다운로드                    │
│     queue/              BullMQ 잡 enqueue/poll              │
│     notify/             Resend 이메일                        │
│   lib/                                                      │
│     db.ts               Prisma client                       │
│     auth.ts             NextAuth config                     │
│     srt.ts              SRT 파서/생성기                       │
│   types/                                                    │
│ prisma/                                                     │
│   schema.prisma                                             │
│ worker/                 별도 프로세스 (GPU 노드에서 실행)     │
│   index.ts              BullMQ Worker (Whisper 호출)         │
│   whisper.py            Python Whisper 호출 스크립트          │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 System Topology (MVP)

```
[Browser]
   │ 멀티파트 업로드
   ▼
[Next.js (Vercel)] ── R2 (영상 저장) ── PostgreSQL (잡 메타)
   │ enqueue
   ▼
[Redis (BullMQ)]
   │ pull
   ▼
[GPU Worker (Self-host)]
   ├ ffmpeg (음성 추출)
   ├ Whisper large-v3 (ko)
   └ R2 (SRT 업로드) ── PostgreSQL (잡 상태 업데이트)
                        │
                        ▼
                  [Resend 이메일]
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] `CLAUDE.md` 없음 — 신규 작성 필요
- [ ] `docs/01-plan/conventions.md` 없음 — Phase 2에서 작성
- [ ] `CONVENTIONS.md` 없음
- [ ] ESLint 미설정
- [ ] Prettier 미설정
- [ ] `tsconfig.json` 미설정

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | missing | 컴포넌트 PascalCase, 함수/변수 camelCase, 파일 kebab-case | High |
| **Folder structure** | missing | 위 7.3 구조 고정, `features/` 도메인 단위 | High |
| **Import order** | missing | external → internal alias(`@/`) → 상대 경로 | Medium |
| **Environment variables** | missing | 아래 8.3 항목, `env.ts`로 zod 검증 | High |
| **Error handling** | missing | API: 표준 에러 응답 `{code, message}` / 워커: 재시도 3회 후 dead-letter | High |
| **Logging** | missing | pino(JSON) + Vercel logs / 워커는 stdout JSON | Medium |
| **Commit** | missing | Conventional Commits (`feat:`, `fix:`, ...) | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `DATABASE_URL` | PostgreSQL 연결 | Server | ☐ |
| `REDIS_URL` | BullMQ Redis 연결 | Server + Worker | ☐ |
| `AUTH_SECRET` | NextAuth secret | Server | ☐ |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Server | ☐ |
| `AUTH_GOOGLE_SECRET` | Google OAuth secret | Server | ☐ |
| `R2_ACCOUNT_ID` | Cloudflare R2 계정 | Server + Worker | ☐ |
| `R2_ACCESS_KEY_ID` | R2 액세스 키 | Server + Worker | ☐ |
| `R2_SECRET_ACCESS_KEY` | R2 시크릿 키 | Server + Worker | ☐ |
| `R2_BUCKET_VIDEOS` | 영상 버킷 이름 | Server + Worker | ☐ |
| `R2_BUCKET_SUBTITLES` | 자막 버킷 이름 | Server + Worker | ☐ |
| `RESEND_API_KEY` | 이메일 발송 키 | Server | ☐ |
| `EMAIL_FROM` | 발송자 이메일 주소 | Server | ☐ |
| `WHISPER_MODEL` | `large-v3` 등 모델 선택 | Worker | ☐ |
| `WHISPER_DEVICE` | `cuda` / `cpu` | Worker | ☐ |
| `PUBLIC_APP_URL` | 공유 링크 base URL | Server | ☐ |
| `GUEST_DAILY_CAP` | 게스트 일일 총 처리량 한도 | Server | ☐ |

### 8.4 Pipeline Integration

| Phase | Status | Document Location | Command |
|-------|:------:|-------------------|---------|
| Phase 1 (Schema) | ☐ | `docs/01-plan/schema.md` | `/pipeline-next` |
| Phase 2 (Convention) | ☐ | `docs/01-plan/conventions.md` | `/pipeline-next` |

**다음 단계 권장**:
- `/phase-1-schema`로 ERD·테이블 상세 정의
- `/phase-2-convention`으로 코딩 컨벤션 확정

---

## 9. Next Steps

1. [ ] (선택) `/pdca pm video-auto-caption` — PRD/페르소나/경쟁사 분석 강화
2. [ ] `/pdca design video-auto-caption` — 3개 아키텍처 옵션 비교 + 상세 설계 문서
3. [ ] Phase 1 Schema, Phase 2 Convention 정의 (병행 가능)
4. [ ] GPU 서버 사전 확보 (집/임대) 및 Whisper 설치 PoC
5. [ ] Cloudflare R2 버킷 생성 및 자동 삭제 lifecycle rule 설정
6. [ ] 검증용 한국어 영상 30개 셋 수집 (정확도 측정용)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-13 | Initial draft (요구사항 + 아키텍처 1차 결정) | shong7500 |
