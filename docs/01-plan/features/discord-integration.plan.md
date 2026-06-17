---
template: plan
version: 1.3
feature: discord-integration
date: 2026-06-15
author: shong7500
project: make_cc
status: Draft
---

# discord-integration Planning Document

> **Summary**: make_cc에 Discord를 통합 — (1) 로그인한 사용자가 마이페이지에서 Discord 계정을 **Account Linking** 방식으로 연결, (2) 잡 완료·실패 시 **Discord DM 알림** 발송, (3) Discord 서버를 **공지·업데이트·문의 허브**(Option C — Pragmatic Balance 채널 구조)로 활용해 별도 admin/CS UI 빌드 부담 제거.
>
> **Project**: make_cc
> **Version**: 0.5.0
> **Author**: shong7500
> **Date**: 2026-06-15
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 별도 admin/공지 UI 빌드 비용 + Resend 이메일 도달률 저하(스팸 필터·미확인) + 매직링크 외 추가 로그인 옵션 부재로 한국 영상 크리에이터 사용자 마찰 |
| **Solution** | Discord OAuth는 **메인 로그인이 아닌 Account Linking 전용** (한국 시장 적합도 분석 기반). Discord Bot이 finished/failed 잡에 대해 **개인 DM** 발송. Discord 서버 자체가 공지/업데이트/문의 채널 — **Option C(Pragmatic Balance)** 채널 구조로 1인 운영 가능한 선에서 admin UI 빌드 회피 |
| **Function/UX Effect** | 마이페이지에 "Discord 연결" 버튼 / 알림 경로 토글(Discord DM · 이메일 · 둘 다) / 잡 완료 시 다운로드 링크 DM / 잡 실패 시 원인 + 재시도 안내 DM / Discord 서버 초대 링크 헤더 노출 |
| **Core Value** | "혼자 만든 SaaS"에서 **"사용자와 운영자가 같은 채팅방에 있는 살아있는 서비스"**로 격상 — 관리·소통·신뢰의 단일 채널화 + 운영 비용 최소화 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Resend 이메일 도달률 저하·admin UI 빌드 비용·매직링크 외 알림 채널 부재. 단일 운영 허브 필요 |
| **WHO** | 영상 크리에이터(유튜버·강의자·회의 녹화) 회원, Discord 친화 얼리어답터, 운영자(shong7500) 본인 |
| **RISK** | Discord 서버 미참여 사용자에게 봇 DM 불가 / Bot 토큰 유출 / Resend 알림 중복 또는 손실 / Discord API rate limit / 1인 운영자의 채널 관리 부담 |
| **SUCCESS** | DM 발송 성공률 ≥ 95%, Account Linking 전환율 ≥ 30%(linked / total finished), 알림 토글로 양쪽 0% 이탈, 죽은 채널 0개 |
| **SCOPE** | Phase1: Account Linking + DM 알림(finished/failed) + 서버 채널 구조 셋업 / Phase2: 공지 자동 발송, 슬래시 커맨드 / Phase3(out): 음성 채널 실시간 STT |

---

## 1. Overview

### 1.1 Purpose

make_cc의 알림·관리·커뮤니티 채널을 Discord로 통합한다.
**핵심은 "Discord OAuth 메인 로그인"이 아니라 "Account Linking + 알림 라우팅 + 운영 허브"**.
이로써 별도 admin UI를 빌드하지 않고도 공지·업데이트·문의 흐름을 운영자(shong7500) 한 명이 감당할 수 있는 구조를 만든다.

### 1.2 Background

- 2026 인증 트렌드 분석 결과: 한국 시장은 Naver(검색 62.86%) + Kakao(95.1% 침투) 듀오폴리. Google·Apple 점유율 상승. Discord OAuth는 **게이밍·개발자 툴·NFT** 도메인에 집중 → 영상 크리에이터 메인 ID로는 부적합.
- 그러나 **알림·커뮤니티·관리** 측면에서 Discord는 동시성·도달률·반응성 모두 이메일을 크게 상회.
- 결론: Discord는 "메인 로그인"이 아니라 **"한 번 연결하면 평생 알림+커뮤니티 경로"**가 되는 Account Linking 모델.
- Resend 이메일은 **fallback / 이중 발송 옵션**으로 유지.
- **서버 설계 결정 (2026-06-15)**: 1인 운영 SaaS의 Discord 서버는 채널 과잉이 곧 "죽은 채널"이 되어 신뢰를 떨어뜨린다. 미니멀(2채널)은 문의가 잡담에 묻히고, 풀 커뮤니티(10+채널·레벨링 봇)는 운영 부담 과다 → **Option C(Pragmatic Balance)** 채택. §7.5 참조.

### 1.3 Related Documents

- 이전 Plan: `docs/01-plan/features/video-auto-caption.plan.md` (Resend 이메일 알림 설계)
- 이전 Plan: `docs/01-plan/features/speaker-diarization.plan.md` (현 진행 중 feature)
- Memory: `project_discord_integration.md` (2026-06-15 사용자 확정 사항)
- 참고:
  - Supabase Auth Discord provider: https://supabase.com/docs/guides/auth/social-login/auth-discord
  - Discord Developer Portal: https://discord.com/developers/applications
  - Discord REST API DM: https://discord.com/developers/docs/resources/user#create-dm
  - discord.js: https://discord.js.org/

---

## 2. Scope

### 2.1 In Scope (Phase 1 — MVP)

- [ ] **Account Linking 플로우**: 마이페이지에 "Discord 연결" 버튼 → Supabase Auth Discord OAuth → 콜백 후 `user_profiles.discord_user_id` 저장
- [ ] **연결 해제 (Unlink)**: 동일 위치 토글로 즉시 해제
- [ ] **DB 마이그레이션**: `user_profiles.discord_user_id text`, `user_profiles.discord_username text`, `user_profiles.notify_channel text default 'email'` (`email` | `discord` | `both`)
- [ ] **Discord Bot Application 등록**: Developer Portal에 봇 생성, 토큰을 `DISCORD_BOT_TOKEN` 환경변수로 등록
- [ ] **services/notify/discord.ts**: HTTP POST로 DM 발송 (Gateway 연결 없음 — REST API only)
- [ ] **알림 라우터 확장 (`services/notify/index.ts`)**: 사용자의 `notify_channel`을 읽어 Discord / Email / 둘 다 디스패치
- [ ] **잡 완료 DM**: `markFinished` 시 `Job finished — 다운로드` + signed URL
- [ ] **잡 실패 DM**: `markFailed` 시 `Job failed — {errorCode}` + 재시도 안내 링크
- [ ] **마이페이지 "알림 경로" 토글**: Discord DM · 이메일 · 둘 다 (Discord 연결된 경우만 노출)
- [ ] **Discord 서버 채널 구조 셋업 (Option C)**: §7.5의 4 카테고리 / 8~9 채널 / 3 역할 + 봇 초대 + 권한 설정
- [ ] **운영 가이드**: 서버 채널 구조 + 봇 권한 + 사용자 가이드 (`docs/operations/discord-setup.md`)
- [ ] **로그인 화면**: Discord OAuth 버튼 **추가하지 않음** (메인 로그인은 매직링크 유지)
- [ ] **테스트**: notify dispatcher 단위 테스트(채널 선택 로직), Discord REST mock 테스트

### 2.2 Out of Scope (Phase 2+)

- 공지사항 자동 발송 (어드민 페이지에서 공지 작성 → `#공지사항` 채널 자동 게시 via webhook)
- 슬래시 커맨드 (`/upload` 등 Discord에서 영상 업로드)
- 공용 채널 잡 완료 공유 (커뮤니티 활성화)
- 진행률 알림 (50%, 90% 같은 중간 DM)
- 편집기 공유 링크 생성 시 DM
- Kakao OAuth, Apple Sign In, Passkey (별도 PDCA — `/pdca plan auth-providers`)
- Discord 음성 채널 실시간 STT (별도 feature)
- 문의 자동 티켓 시스템 (수동 처리부터)
- 레벨링/리액션 롤/이벤트 봇 (Option B 영역 — 채택 안 함)

### 2.3 Out of Scope (전체 — 영구)

- Discord OAuth 메인 로그인 (한국 영상 크리에이터 타겟 부적합으로 결론)

---

## 3. Stakeholders

| Role | Person | 책임 |
|------|--------|------|
| Owner / Dev / Ops | shong7500 | 구현 + Discord 서버 운영 + 봇 토큰 관리 |
| 사용자 (영상 크리에이터) | TBD | Discord 계정 연결(선택) + 알림 경로 선택 |
| 운영자 (장기) | shong7500 | 공지/업데이트/문의 채널 관리 |

---

## 4. Requirements

### 4.1 Functional

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| F-01 | 로그인된 사용자가 마이페이지에서 "Discord 연결" 버튼으로 OAuth 진입 | P0 |
| F-02 | OAuth 콜백에서 Discord `user_id` + `username`을 `user_profiles`에 저장 | P0 |
| F-03 | 사용자가 "Discord 연결 해제" 토글로 즉시 해제 (필드 null 처리) | P0 |
| F-04 | 잡 finished 시 Discord DM 발송: 텍스트 + 다운로드 signed URL | P0 |
| F-05 | 잡 failed 시 Discord DM 발송: errorCode + errorMessage + 재시도 안내 | P0 |
| F-06 | 마이페이지에서 알림 경로 토글 (`email` / `discord` / `both`) | P0 |
| F-07 | 알림 라우터가 사용자 `notify_channel`을 기반으로 분기 | P0 |
| F-08 | Discord 미연결 사용자는 자동으로 `notify_channel='email'` (기존 동작) | P0 |
| F-09 | DM 발송 실패 시 graceful degrade: 이메일 fallback (선택 `both`/`discord` 모두) | P1 |
| F-10 | 운영 가이드 문서 1편 (`docs/operations/discord-setup.md`) | P1 |
| F-11 | Discord 서버 초대 링크 사이트 헤더/푸터 노출 | P2 |
| F-12 | 서버 채널 구조(Option C)가 셋업되고 봇이 `#봇-로그`에만 쓰기 권한 보유 | P1 |

### 4.2 Non-Functional

| ID | 요구사항 |
|----|----------|
| N-01 | DM 발송 P95 응답 시간 < 2초 (worker에서 동기 호출) |
| N-02 | DM 발송 성공률 ≥ 95% (Discord 미참여·privacy 차단 제외) |
| N-03 | Bot 토큰은 server-side만 (Vercel env / 워커 env). 클라이언트 노출 0% |
| N-04 | Discord REST API rate limit 준수 (per-user DM은 보통 5/5s, 큐 backoff 적용) |
| N-05 | OAuth 콜백 + Unlink 모두 CSRF 방어 (Supabase 기본 state 사용) |
| N-06 | DM 본문에 자막 원문 절대 포함 금지 (영상 컨텐츠 프라이버시) — 다운로드 링크만 |

### 4.3 Constraints

- **Discord 서버 참여 필수**: 사용자가 봇 DM을 받으려면 봇과 같은 서버에 속해야 함 → 운영 가이드 + 마이페이지에 서버 초대 링크 강조
- **봇 권한 최소화**: Send Messages, Use Slash Commands(나중 Phase 2용 — 지금 OFF), Read Message History(불필요 OFF)
- **현행 인증 무변경**: 매직링크 + Supabase Auth 그대로 유지. Discord OAuth는 Account Linking 전용 callback path만 추가
- **service_role 키 보호** (기존 CLAUDE.md 보안 정책): Discord linking 트랜잭션도 server-side에서만 수행
- **이메일 알림 (Resend) 제거 금지**: 사용자 선택 가능, 기본값은 미연결 사용자에게 email

---

## 5. Risks & Mitigations

| 위험 | 영향 | 대응 |
|------|------|------|
| 사용자가 우리 Discord 서버에 참여하지 않으면 봇 DM 불가 | DM 미발송 → 알림 누락 | 마이페이지에서 연결 직전 "Discord 서버 먼저 참여 필요" 안내 + 초대 링크. 첫 DM 실패 시 이메일 fallback 즉시 발송 |
| Discord Bot 토큰 유출 → 봇 권한 도용 | 보안 침해, 신뢰 손실 | `.env` + Vercel env만. 토큰 노출 의심 시 즉시 재발급. 봇 권한 최소화로 피해 범위 제한 |
| Discord REST API rate limit (per-user 5/5s, global 50/s) 초과 | DM 일시 지연 | 워커에서 발송 큐(짧은 in-memory queue) + 429 응답 시 retry-after 헤더 기반 backoff |
| 사용자 privacy 설정 차단 ("Allow direct messages from server members" OFF) | DM 발송 실패 | API 응답 50007 (Cannot send messages to this user) 감지 → 이메일 fallback + 마이페이지에 "DM 차단됨, privacy 설정 확인" 안내 배지 |
| Discord OAuth 콜백이 매직링크 callback과 충돌 | 로그인 흐름 깨짐 | callback URL 분리 (`/auth/callback`은 매직링크 / `/auth/discord/callback`은 linking 전용) |
| Resend + Discord 이중 발송으로 중복 알림 | UX 노이즈 | 사용자 토글이 명시적이라 의도적 선택일 때만 발생. 기본값은 단일 발송 |
| Discord Account Linking 후 OAuth provider 분리 어려움 | 사용자 혼란 | "연결 해제"는 단순히 user_profiles 필드 null 처리 — Supabase Auth identity는 건드리지 않음 |
| 채널 과잉으로 죽은 채널 양산 → 서버 신뢰 저하 | 커뮤니티 인상 악화 | Option C로 채널 최소화. Phase 1은 8~9채널 고정, 사용 데이터 보고 확장 |

---

## 6. Implementation Approach

### 6.1 High-Level

1. **DB**: `user_profiles` 테이블 신설 또는 기존 확장 (`discord_user_id`, `discord_username`, `notify_channel`) + RLS 정책
2. **Auth**: Supabase Dashboard에서 Discord provider 활성화, 콜백 URL 추가
3. **Linking 페이지**: `app/(member)/account/page.tsx`에 "Discord 연결" 섹션 + Server Action (`linkDiscord`, `unlinkDiscord`)
4. **Bot 서비스**: `services/notify/discord.ts` — discord.js 아예 안 쓰고 `fetch`로 REST API 직접 호출 (의존성 최소화)
5. **Notify 라우터**: `services/notify/index.ts` — 사용자 notify_channel 기준 분기
6. **Worker 통합**: `markFinished`/`markFailed` 후 `dispatchNotify({jobId, type})` 호출
7. **운영 셋업**: Discord 서버 + 채널(Option C) + 봇 초대 + 권한 가이드 문서화

### 6.2 키 파일

| 영역 | 파일 |
|------|------|
| Migration | `supabase/migrations/20260616000001_user_profiles_discord.sql` |
| 환경변수 | `lib/env.ts` (`DISCORD_BOT_TOKEN`, `DISCORD_OAUTH_REDIRECT_URL`, `DISCORD_INVITE_URL`) |
| Notify 인프라 | `services/notify/discord.ts`, `services/notify/index.ts` |
| Auth | `services/auth/discord.ts` (linkDiscord/unlinkDiscord server actions) |
| UI | `app/(member)/account/page.tsx`, `features/account/DiscordLinkSection.tsx` |
| 타입 | `types/user.ts` (UserProfile, NotifyChannel) |
| 테스트 | `tests/unit/services/notify/discord.spec.ts`, `tests/unit/services/notify/router.spec.ts` |
| 운영 문서 | `docs/operations/discord-setup.md` |

### 6.3 외부 의존성

- **추가 의존성 없음** (Discord REST API는 `fetch`만으로 충분)
- 단, 향후 슬래시 커맨드 도입 시 `discord.js` 또는 `discord-interactions` 도입 검토

---

## 7. Architecture Considerations

### 7.1 Project Level

기존 make_cc(**Dynamic Level**, Option C Pragmatic Modular) 유지. `services/notify`, `services/auth`에 모듈 추가, 신규 인프라 없음 (봇은 REST 호출만이라 별도 프로세스 불필요).

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Discord 로그인 모델 | A. 메인 OAuth 로그인 B. Account Linking 전용 | **B. Account Linking** | 한국 영상 크리에이터 타겟에 Discord 메인 ID 부적합. 매직링크 유지 + 알림 경로만 연결 |
| DM 발송 방식 | A. discord.js Gateway 봇 상주 B. REST API `fetch` 직접 호출 | **B. REST only** | DM은 `POST /users/@me/channels` → `POST /channels/{id}/messages` 2-step REST로 충분. Gateway 상주 프로세스 비용 제거, 의존성 0 |
| 알림 채널 라우팅 | A. 코드 분기 하드코딩 B. `user_profiles.notify_channel` 데이터 주도 | **B. 데이터 주도** | 사용자가 토글로 제어, 워커는 값만 읽어 분기. 이메일/Discord/both 확장 용이 |
| 봇 알림 전달 위치 | A. 공용 채널 게시 B. 개인 DM | **B. 개인 DM** | 잡 결과는 사적 데이터(다운로드 링크). 채널 스팸 방지 + 프라이버시 |
| Discord 서버 구조 | A. 미니멀 2채널 B. 풀 커뮤니티 10+채널·봇 C. Pragmatic Balance 8~9채널 | **C. Pragmatic Balance** | A는 문의가 잡담에 묻힘, B는 1인 운영 부담·죽은 채널. C는 공지·커뮤니티·지원 분리하되 관리 가능 (§7.5) |
| Unlink 처리 | A. Supabase Auth identity 삭제 B. user_profiles 필드 null | **B. 필드 null** | Auth identity는 건드리지 않아 혼란·재로그인 깨짐 방지 |

### 7.3 Folder Structure Preview

```
src/
  services/
    notify/
      index.ts          (확장 — notify_channel 기준 dispatch)
      discord.ts        (NEW — REST DM 발송)
      email.ts          (기존 Resend 유지)
    auth/
      discord.ts        (NEW — linkDiscord / unlinkDiscord server actions)
  features/
    account/
      DiscordLinkSection.tsx   (NEW — 연결/해제 + 알림 토글)
  app/
    (member)/account/page.tsx  (확장 — Discord 섹션 마운트)
    auth/discord/callback/route.ts  (NEW — linking 콜백)
  types/
    user.ts            (UserProfile, NotifyChannel = 'email'|'discord'|'both')
  lib/
    env.ts             (DISCORD_BOT_TOKEN, DISCORD_OAUTH_REDIRECT_URL, DISCORD_INVITE_URL)

supabase/
  migrations/
    20260616000001_user_profiles_discord.sql   (NEW)

docs/
  operations/
    discord-setup.md   (NEW — 서버 구조 + 봇 권한 + 사용자 가이드)
```

### 7.4 Data Flow

```
[Account Linking]
  마이페이지 "Discord 연결" 클릭
     ↓
  Supabase Auth Discord OAuth (linking redirect)
     ↓
  /auth/discord/callback  → discord_user_id / username 추출
     ↓
  user_profiles UPSERT (server-side, service_role)

[잡 알림]
  worker: markFinished / markFailed
     ↓
  dispatchNotify({ jobId, type })           ← services/notify/index.ts
     ↓
  user_profiles.notify_channel 조회
     ├─ 'email'   → sendEmail (Resend)
     ├─ 'discord' → sendDiscordDM (REST)
     └─ 'both'    → 둘 다
     ↓
  Discord DM 실패(50007/미참여) → email fallback + 마이페이지 배지
```

### 7.5 Discord Server Design — Option C (Pragmatic Balance) ★

> 채택 결정 (2026-06-15). 미니멀(A)·풀 커뮤니티(B) 대비 1인 운영자가 감당 가능한 채널 분리.

**카테고리 / 채널 (8~9개)**

```
📌 시작하기
  #환영-규칙        (read-only) make_cc 소개 + 규칙 + 계정 연결 안내
📣 공지
  #공지사항         (read-only, @everyone) 운영자 공지
  #업데이트          (read-only) 릴리스·기능 변경 changelog
💬 커뮤니티
  #일반              자유 잡담
  #자막-자랑         결과물 공유 (showcase)
  #피드백-제안       기능 요청·아이디어
🛟 지원
  #문의              Q&A·사용법
  #버그-신고         버그 리포트
🤖 (비공개)
  #봇-로그          운영자 전용. 봇 DM 발송 실패·rate limit 경고만 기록
```

**역할 (3개 + 봇)**

| Role | 부여 | 권한 |
|------|------|------|
| `@운영자` | shong7500 | 전체 관리 |
| `@회원` | 계정 연결 사용자 (Phase 2 자동 부여 검토, Phase 1 수동) | 커뮤니티·지원 채널 쓰기 |
| `@손님` | 서버 입장 기본 | 읽기 + #일반 쓰기 |
| `make-cc-bot` | — | `#봇-로그` 쓰기 + 개인 DM 발송만. 공개 채널 쓰기 OFF |

**근거**
- **Option A (미니멀 2채널)** 거부: 공지/문의/잡담이 한 채널에 섞여 운영자가 문의를 놓침.
- **Option B (풀 커뮤니티)** 거부: 레벨링·리액션 롤·이벤트·다수 음성 채널은 1인 운영 부담, 트래픽 부족 시 죽은 채널 → 서버가 비어 보임.
- **Option C 선택**: 공지·커뮤니티·지원 3축만 명확히 분리. 봇 알림은 DM이 주 경로라 채널을 더럽히지 않음. 사용량 데이터 확인 후 Phase 2에서만 확장.

---

## 8. Impact Analysis

### 8.1 Changed/New Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `user_profiles` table | DB Schema | `discord_user_id text`, `discord_username text`, `notify_channel text default 'email'` 추가 (+RLS: 본인 row만 read/update) |
| `services/notify/discord.ts` | New | REST DM 발송 (`fetch`) |
| `services/notify/index.ts` | Modified | notify_channel 기준 dispatch 분기 |
| `services/notify/email.ts` | None~Minor | 기존 Resend 유지, 라우터에서 호출되도록만 정리 |
| `services/auth/discord.ts` | New | linkDiscord / unlinkDiscord server actions |
| `app/auth/discord/callback/route.ts` | New | Discord linking 콜백 (매직링크 콜백과 경로 분리) |
| `app/(member)/account/page.tsx` | Modified | DiscordLinkSection 마운트 |
| `features/account/DiscordLinkSection.tsx` | New | 연결/해제 + 알림 토글 UI |
| `types/user.ts` | New/Modified | UserProfile, NotifyChannel 타입 |
| `lib/env.ts` | Modified | DISCORD_BOT_TOKEN / DISCORD_OAUTH_REDIRECT_URL / DISCORD_INVITE_URL |
| `worker` markFinished/markFailed | Modified | dispatchNotify 호출 추가 |
| `supabase/migrations/20260616000001_user_profiles_discord.sql` | New | 컬럼 + RLS |

### 8.2 Current Consumers (기존 코드 영향)

| Resource | Operation | Impact |
|----------|-----------|--------|
| 기존 이메일 알림 (Resend) | markFinished/markFailed에서 직접 호출 | dispatchNotify 경유로 리팩터. 미연결 사용자는 `notify_channel='email'` 기본값이라 **동작 불변** |
| Supabase Auth (매직링크) | `/auth/callback` | 경로 분리(`/auth/discord/callback`)로 **충돌 없음** |
| `user_profiles` 미존재 사용자 | 잡 알림 | 마이그레이션이 기존 사용자에 default row/값 보장 또는 NULL→email fallback 처리 |
| service_role 트랜잭션 | linking/unlink | server-side only, RLS 우회는 admin client에서만 |

### 8.3 Verification

- [ ] 미연결 사용자의 알림이 기존 이메일 경로로 회귀 0건
- [ ] `/auth/callback`(매직링크)과 `/auth/discord/callback`(linking)이 서로 간섭하지 않음
- [ ] DM 발송 실패(50007/미참여) 시 이메일 fallback이 정확히 1회 발송
- [ ] notify_channel='both'일 때 이메일+DM 각각 1회 (중복/누락 없음)
- [ ] Bot 토큰이 클라이언트 번들에 포함되지 않음 (빌드 산출물 grep 0건)

---

## 9. Convention Prerequisites

### 9.1 Existing Project Conventions

- [x] `CLAUDE.md` 임포트 경계 (app→services, services→lib) — Discord 봇 호출은 `services/notify`에 격리
- [x] Supabase 클라이언트 선택 규칙 (server/browser/admin) — linking은 server, dispatch는 worker admin
- [x] 잡 상태 머신 + append-only `job_events` — 알림은 전이 *후* 부수효과로만
- [x] `lib/env.ts` Zod 검증 (process.env 직접 사용 금지)
- [x] `lib/api.ts` apiOk/apiError 표준 응답

### 9.2 Conventions to Define/Verify

| Category | Current | To Define | Priority |
|----------|---------|-----------|:--------:|
| NotifyChannel enum | 미정 | `'email' \| 'discord' \| 'both'` (DB text + zod) | High |
| Discord DM 메시지 포맷 | 미정 | 1줄 제목 + 다운로드 링크 / 자막 원문 금지 | High |
| Discord 콜백 경로 | 미정 | `/auth/discord/callback` (매직링크와 분리) | High |
| 봇 권한 스코프 | 미정 | Send Messages + DM only, 나머지 OFF | High |
| rate limit backoff | 미정 | 429 retry-after 헤더 기반, 최대 3회 | Medium |

### 9.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `DISCORD_BOT_TOKEN` | 봇 DM 발송 인증 | Worker + Server | ☐ |
| `DISCORD_OAUTH_REDIRECT_URL` | linking 콜백 URL | Server | ☐ |
| `DISCORD_INVITE_URL` | 서버 초대 링크 (헤더/마이페이지) | Public(NEXT_PUBLIC) | ☐ |
| `DISCORD_GUILD_ID` | (옵션) 서버 참여 여부 확인용 | Server | ☐ |

---

## 10. Success Criteria

- [ ] Account Linking 플로우가 양방향(연결·해제) 정상 작동
- [ ] finished/failed 잡에 대해 Discord DM이 옳은 사용자에게 도달 (성공률 ≥ 95%, privacy 차단 제외)
- [ ] 마이페이지 알림 경로 토글이 워커 알림 발송 흐름에 즉시 반영
- [ ] Discord 서버 Option C 채널 구조 + 봇 권한 셋업 완료 + 운영 가이드 1편 작성
- [ ] DM 본문에 자막 원문 노출 0건 (다운로드 링크 형태만)
- [ ] Bot 토큰 클라이언트 노출 0건 (Vercel env / 워커 env만)
- [ ] notify 라우터 + Discord DM 발송 단위 테스트 통과, 회귀 0

---

## 11. Timeline (Indicative)

| Phase | 산출물 | 시간 추정 |
|-------|--------|----------|
| Phase 1.1 | Discord Application 등록 + Bot 토큰 발급 + Supabase provider 활성화 | 30분 (운영) |
| Phase 1.2 | DB 마이그레이션 + 타입 + env 설정 | 1시간 |
| Phase 1.3 | services/notify/discord.ts + 라우터 + 단위 테스트 | 2시간 |
| Phase 1.4 | Server actions (linkDiscord/unlinkDiscord) + 마이페이지 UI | 2시간 |
| Phase 1.5 | Worker 통합 (markFinished/markFailed → dispatchNotify) | 1시간 |
| Phase 1.6 | Discord 서버 Option C 셋업 + 운영 가이드 문서 | 1.5시간 (운영) |
| **합계** | MVP | ~8시간 (구현 6시간 + 운영 2시간) |

---

## 12. Open Questions

- [ ] 운영 가이드(`docs/operations/discord-setup.md`)는 한국어/영어 모두? → Design 단계에서 결정
- [ ] Discord 봇 이름·아바타·소개 → 운영자 결정 (`make-cc-bot` 잠정)
- [ ] DM 발송 실패 시 이메일 fallback이 자동인지, 사용자에게 다시 묻는지 → Design에서 결정 (잠정: 자동)
- [ ] `@회원` 역할 자동 부여를 Phase 1에 넣을지(봇이 guild member role 부여) Phase 2로 미룰지
- [ ] 우리 Discord 서버 URL → 운영자가 서버 만든 후 invite link 확정

---

## 13. Next Steps

1. [ ] `/pdca design discord-integration` — notify 라우터 + linking 시퀀스 + DM 포맷 상세 설계
2. [ ] Discord Application + Bot 생성, 토큰 발급 (운영자)
3. [ ] Supabase Dashboard에서 Discord provider 활성화 + 콜백 URL 등록 (운영자)
4. [ ] Option C 서버 채널 구조 생성 + 봇 초대 (운영자)
5. [ ] `/pdca do discord-integration --scope module-1` (DB+env) 부터 단계적

---

## 14. References

- Auth/UX 트렌드 리서치 (2026-06-15): Authsignal, MojoAuth(Passkey/Email), InterAd(Korean Search), DataReportal(Digital 2026 Korea)
- Discord OAuth on Supabase: https://supabase.com/docs/guides/auth/social-login/auth-discord
- Discord REST API: https://discord.com/developers/docs/intro
- Discord Create DM: https://discord.com/developers/docs/resources/user#create-dm
- 메모리 기록: `~/.claude/projects/.../memory/project_discord_integration.md`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.4.0 | 2026-06-15 | Initial draft (Account Linking 모델 + DM 알림 + 운영 허브) | shong7500 |
| 0.5.0 | 2026-06-15 | Option C(Pragmatic Balance) 서버 설계 §7.5 확정, Architecture Decisions·Impact Analysis·Convention Prerequisites·Version History 추가 (house style 정합) | shong7500 |
