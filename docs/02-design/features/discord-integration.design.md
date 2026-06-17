---
template: design
version: 1.3
feature: discord-integration
date: 2026-06-15
author: shong7500
project: make_cc
status: Draft
---

# discord-integration Design Document

> **Summary**: Supabase `linkIdentity` 기반 Discord **Account Linking** + `services/notify` 단일 dispatcher가 `user_profiles.notify_channel`을 읽어 Email/Discord/both 분기. Discord DM은 Bot 토큰으로 **REST 2-step** 발송(Gateway 미상주). 실패 시 이메일 fallback. 서버는 Option C 채널 구조로 운영 허브화.
>
> **Project**: make_cc
> **Version**: 0.1.0
> **Author**: shong7500
> **Date**: 2026-06-15
> **Status**: Draft
> **Planning Doc**: [discord-integration.plan.md](../../01-plan/features/discord-integration.plan.md)
> **Parent Feature**: video-auto-caption (Resend 이메일 알림 — 본 feature가 dispatcher로 래핑)

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
| **WHY** | Resend 이메일 도달률 저하·admin UI 빌드 비용·매직링크 외 알림 채널 부재. 단일 운영 허브 필요 |
| **WHO** | 영상 크리에이터(유튜버·강의자·회의 녹화) 회원, Discord 친화 얼리어답터, 운영자(shong7500) |
| **RISK** | 서버 미참여 시 봇 DM 불가 / Bot 토큰 유출 / 알림 중복·손실 / Discord API rate limit / 1인 운영 부담 |
| **SUCCESS** | DM 발송 성공률 ≥ 95%, Account Linking 전환율 ≥ 30%, 알림 토글 양쪽 0% 이탈, 죽은 채널 0개 |
| **SCOPE** | Phase1: Account Linking + DM 알림(finished/failed) + 서버 셋업 / Phase2: 공지 자동 발송·슬래시 커맨드 / Phase3(out): 음성 채널 STT |

---

## 1. Overview

### 1.1 Design Goals

- **기존 이메일 회귀 0**: 현 `markFinished/markFailed`의 직접 이메일 호출을 `dispatchNotify`로 한 번 래핑. 미연결 사용자는 `notify_channel='email'` 기본값이라 동작 불변.
- **의존성 0 추가**: Discord DM은 `fetch`만으로 REST 2-step. `discord.js`/Gateway 상주 프로세스 없음.
- **데이터 주도 라우팅**: 어떤 채널로 보낼지는 코드가 아닌 `user_profiles.notify_channel` 값이 결정. 사용자가 토글로 제어.
- **인증 무변경**: 매직링크 메인 로그인 그대로. Discord는 로그인된 사용자가 마이페이지에서 `linkIdentity`로 연결하는 **전용 콜백 경로**만 추가.
- **Graceful degrade**: DM 실패(미참여·privacy 차단·rate limit)면 이메일 fallback + 마이페이지 배지.

### 1.2 Design Principles

- **얇은 채널 함수**: `sendDiscordDM`, `sendEmail`은 동일 시그니처(`NotifyMessage → Promise<NotifyResult>`)의 순수에 가까운 함수. dispatcher만 분기 보유.
- **단일 dispatch 지점**: 워커/웹 어디서 알림이 나가든 `dispatchNotify` 하나만 호출.
- **Server-side only 비밀**: Bot 토큰·service_role은 워커/서버 env에만. 클라이언트 번들 유입 0.
- **Append-only 존중**: 알림은 잡 상태 전이 *후* 부수효과. 상태 머신은 건드리지 않음.
- **DM 본문 최소권한**: 자막 원문 절대 미포함. 제목 + signed 다운로드 링크만.

---

## 2. Architecture Options (선정 완료)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | **Option C: Pragmatic ⭐** |
|----------|:-:|:-:|:-:|
| **Approach** | discord.ts + 호출부 if 분기 인라인 | Channel 인터페이스 + 클래스 + Dispatcher + provider 추상화 | notify 단일 dispatcher + 채널 함수 분리 + auth server actions |
| **New Files** | ~6 | ~16 | **~10** |
| **Modified Files** | ~5 | ~8 | **~6** |
| **Lines** | ~600 | ~1,500 | **~1,000** |
| **세션 수** | 1 | 2 | **1~2** |
| **테스트 용이** | ⚠️ 분기 분산 | ✅ | ✅ |
| **이메일 회귀 위험** | 중 | 저 | **저** |
| **멀티채널 확장** | ⚠️ | ✅ 최고 | ○ 충분 |
| **Recommendation** | Quick win | 장기 멀티채널 | **Default choice** |

**Selected**: **Option C — Pragmatic Balance**
**Rationale**: 채널을 동일 시그니처 함수로 얇게 분리하면 기존 이메일 경로를 깨지 않고 Discord를 추가할 수 있고, dispatcher 한 곳만 notify_channel 분기를 보유해 테스트가 쉽다. Kakao/Slack 추가가 필요해지면 채널 함수를 registry로 묶어 Option B로 무리 없이 진화 가능. make_cc 전체 Option C(Pragmatic Modular) 철학과 정합.

### 2.1 Component Diagram

```
            ┌─────────────────────────────────────────────┐
            │  Browser (Next.js Client)                    │
            │  - 마이페이지 /account                        │
            │    └ DiscordLinkSection (연결/해제 + 알림토글)│
            │  - Header DiscordInviteLink                  │
            └───────────────┬─────────────────────────────┘
                            │ Server Action
                            ▼
        ┌───────────────────────────────────────────────┐
        │  Next.js App                                   │
        │  ┌──────────────────────────────────────────┐ │
        │  │ app/auth/discord/callback/route.ts (NEW) │ │  ← linkIdentity 콜백
        │  └─────────────────┬────────────────────────┘ │
        │  ┌─────────────────▼────────────────────────┐ │
        │  │ services/auth/discord.ts (NEW)           │ │
        │  │  linkDiscord / unlinkDiscord / getProfile│ │
        │  └─────────────────┬────────────────────────┘ │
        │  ┌─────────────────▼────────────────────────┐ │
        │  │ services/notify/index.ts (dispatcher)    │ │  ← 단일 진입점
        │  │  dispatchNotify(event)                   │ │
        │  │   ├ sendEmail()   (email.ts, 기존)        │ │
        │  │   └ sendDiscordDM() (discord.ts, NEW)    │ │
        │  └──────┬────────────────────────┬──────────┘ │
        └─────────┼────────────────────────┼────────────┘
                  ▼                         ▼
        ┌──────────────────┐     ┌────────────────────────┐
        │ Supabase         │     │ Discord REST API v10   │
        │  auth.identities │     │  POST /users/@me/      │
        │  user_profiles   │     │       channels         │
        │  (notify_channel)│     │  POST /channels/{id}/  │
        └──────────────────┘     │       messages         │
                  ▲              └────────────────────────┘
                  │ admin client (RLS 우회)
        ┌─────────┴─────────────────────────────────────┐
        │  GPU Worker                                    │
        │   markFinished / markFailed                    │
        │     └ dispatchNotify({ jobId, userId, type })  │  ← 동일 dispatcher 재사용
        └────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**(A) Account Linking**
```
1. 마이페이지 "Discord 연결" 클릭
   ↓
2. linkDiscord() server action → supabase.auth.linkIdentity({ provider:'discord',
     options:{ redirectTo: DISCORD_OAUTH_REDIRECT_URL } })
   ↓
3. Discord OAuth 동의 → /auth/discord/callback?code=...
   ↓
4. callback route: exchangeCodeForSession → user.identities에서 discord identity 추출
     discord_user_id = identity.identity_data.provider_id (또는 sub)
     discord_username = identity.identity_data.user_name / full_name
   ↓
5. upsertUserProfile(userId, { discord_user_id, discord_username })  (server, RLS: 본인)
   ↓
6. /account 로 redirect → 섹션이 "연결됨 @username" + 알림 토글 노출
```

**(B) Unlink**
```
1. "연결 해제" 클릭 → unlinkDiscord()
2. user_profiles SET discord_user_id=null, discord_username=null,
     notify_channel = (notify_channel='discord' ? 'email' : notify_channel),
     discord_dm_blocked=false
3. (cleanup, best-effort) supabase.auth.unlinkIdentity(discordIdentity)
   → 실패해도 알림 라우팅은 이미 멈춤 (라우팅은 user_profiles 기준)
```

**(C) 잡 알림**
```
1. worker: transitionStatus → markFinished / markFailed   (상태 머신 불변)
   ↓
2. dispatchNotify({ jobId, userId, type:'finished'|'failed', payload })
   ↓
3. getUserProfile(userId) (admin) → notify_channel, discord_user_id, discord_dm_blocked
   ↓
4. 분기:
   channel ∈ {email, both}             → sendEmail()
   channel ∈ {discord, both} ∧ linked  → sendDiscordDM()
      ├ 200/201 → 성공
      ├ 429     → retry-after backoff (최대 3회)
      └ 50007   → discord_dm_blocked=true 마크 + (channel==='discord'면) sendEmail() fallback
   ↓
5. job_events에 notified 이벤트 append (channel, ok)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `services/notify/index.ts` | auth/discord.getUserProfile, notify/email, notify/discord, services/jobs(이벤트) | 채널 분기 dispatch |
| `services/notify/discord.ts` | `fetch`, lib/env.DISCORD_BOT_TOKEN, lib/logger | REST 2-step DM |
| `services/notify/email.ts` | lib/resend (기존) | 이메일 발송 (래핑) |
| `services/auth/discord.ts` | lib/supabase/server, lib/supabase/admin | link/unlink/profile upsert |
| `app/auth/discord/callback/route.ts` | lib/supabase/server, services/auth/discord | OAuth 콜백 처리 |
| `features/account/DiscordLinkSection.tsx` | server actions, types/user | UI |
| `worker markFinished/markFailed` | services/notify.dispatchNotify | 알림 트리거 |

---

## 3. Data Model

### 3.1 Entity Definition (TypeScript)

```typescript
// src/types/user.ts (NEW)

/** 알림 수신 경로 */
export type NotifyChannel = 'email' | 'discord' | 'both';

export interface UserProfile {
  userId: string;             // auth.users.id (PK, FK)
  discordUserId: string | null;
  discordUsername: string | null;
  notifyChannel: NotifyChannel;     // default 'email'
  discordDmBlocked: boolean;        // privacy 차단(50007) 감지 플래그
  createdAt: string;
  updatedAt: string;
}

/** dispatchNotify 입력 */
export interface NotifyEvent {
  jobId: string;
  userId: string;
  type: 'finished' | 'failed';
  payload: {
    downloadUrl?: string;     // finished: signed URL (자막 원문 금지)
    errorCode?: string;       // failed
    errorMessage?: string;    // failed (사용자 친화 메시지만)
    retryUrl?: string;        // failed: 재시도 안내
  };
}

/** 채널 함수 공통 반환 */
export interface NotifyResult {
  channel: 'email' | 'discord';
  ok: boolean;
  reason?: 'blocked' | 'rate_limited' | 'not_linked' | 'error';
}
```

### 3.2 user_profiles 테이블

```sql
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id   text,
  discord_username  text,
  notify_channel    text not null default 'email'
    check (notify_channel in ('email','discord','both')),
  discord_dm_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: 본인 row만 read/update. insert는 본인 user_id로만.
alter table public.user_profiles enable row level security;

create policy "own profile select" on public.user_profiles
  for select using (auth.uid() = user_id);
create policy "own profile insert" on public.user_profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.user_profiles
  for update using (auth.uid() = user_id);
-- 워커/시스템 쓰기는 admin client(service_role)가 RLS 우회

comment on column public.user_profiles.notify_channel is
  '알림 경로: email | discord | both. Discord 미연결 사용자는 email 고정';
comment on column public.user_profiles.discord_dm_blocked is
  'Discord 50007(DM 차단) 감지 시 true. 마이페이지 배지 + 이메일 fallback 트리거';
```

### 3.3 supabase/migrations/20260616000001_user_profiles_discord.sql

위 §3.2 DDL + `updated_at` 자동 갱신 트리거. 기존 사용자에 대해서는 **lazy 생성**(첫 알림/첫 마이페이지 진입 시 upsert) — 별도 백필 불필요. 라우팅은 row 부재 시 `email`로 간주.

### 3.4 jobs / job_events 영향

- **jobs**: 변경 없음.
- **job_events**: 신규 이벤트 타입 `notified` append (값: `{ channel, ok, reason? }`). 기존 append-only 패턴 그대로.

---

## 4. API Specification

### 4.1 Surface

| Type | Name / Path | Change |
|------|-------------|--------|
| Server Action | `linkDiscord()` | NEW — linkIdentity OAuth 시작 (redirect URL 반환) |
| Server Action | `unlinkDiscord()` | NEW — profile 필드 null + unlinkIdentity(best-effort) |
| Server Action | `setNotifyChannel(channel)` | NEW — notify_channel 갱신 (연결된 경우만 discord/both 허용) |
| Route Handler | `GET /auth/discord/callback` | NEW — OAuth code 교환 + profile upsert |
| Internal | `dispatchNotify(event)` | NEW — 알림 분기 (워커/웹 공용) |

> **REST API 신설 없음.** 마이페이지는 Server Action으로 처리(얇은 컨트롤러 원칙). 알림은 내부 함수.

### 4.2 Server Actions (services/auth/discord.ts)

```typescript
'use server';

export async function linkDiscord(): Promise<{ url: string }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: { redirectTo: env.DISCORD_OAUTH_REDIRECT_URL },
  });
  if (error) throw new AppError('DISCORD_LINK_FAILED', error.message, 502);
  return { url: data.url };   // 클라이언트가 window.location = url
}

export async function unlinkDiscord(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError('UNAUTHORIZED', '로그인이 필요합니다', 401);

  // 1) 라우팅 즉시 차단 (단일 진실: user_profiles)
  await upsertUserProfile(user.id, {
    discord_user_id: null, discord_username: null, discord_dm_blocked: false,
    // discord 단독이었으면 email로 강등
    notify_channel_downgrade: true,
  });

  // 2) best-effort identity cleanup (실패 무시)
  const discordIdentity = user.identities?.find(i => i.provider === 'discord');
  if (discordIdentity) await supabase.auth.unlinkIdentity(discordIdentity).catch(() => {});
}

export async function setNotifyChannel(channel: NotifyChannel): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError('UNAUTHORIZED', '로그인이 필요합니다', 401);
  const profile = await getUserProfile(user.id);
  const linked = !!profile?.discordUserId;
  if ((channel === 'discord' || channel === 'both') && !linked)
    throw new AppError('NOT_LINKED', 'Discord 연결 후 선택 가능합니다', 409);
  await updateNotifyChannel(user.id, channel);  // RLS: 본인
}
```

### 4.3 OAuth Callback (app/auth/discord/callback/route.ts)

```typescript
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const supabase = await createServerSupabase();
  if (code) await supabase.auth.exchangeCodeForSession(code);

  const { data: { user } } = await supabase.auth.getUser();
  const identity = user?.identities?.find(i => i.provider === 'discord');
  if (user && identity) {
    await upsertUserProfile(user.id, {
      discord_user_id: identity.identity_data?.provider_id
                    ?? identity.identity_data?.sub,
      discord_username: identity.identity_data?.user_name
                    ?? identity.identity_data?.full_name
                    ?? identity.identity_data?.name,
    });
  }
  return Response.redirect(new URL('/account?discord=linked', req.url));
}
```

> 매직링크 콜백(`/auth/callback`)과 **경로 완전 분리** → 로그인 흐름 충돌 없음 (Plan 위험 항목 대응).

### 4.4 Discord DM 발송 (services/notify/discord.ts)

```typescript
const API = 'https://discord.com/api/v10';
const HEADERS = () => ({
  Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
  'Content-Type': 'application/json',
});

export async function sendDiscordDM(
  discordUserId: string, message: DiscordMessage,
): Promise<NotifyResult> {
  // 1) DM 채널 개설
  const dm = await fetch(`${API}/users/@me/channels`, {
    method: 'POST', headers: HEADERS(),
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (dm.status === 429) return backoffOrFail(dm, ...);   // retry-after
  if (!dm.ok) return { channel: 'discord', ok: false, reason: 'error' };
  const { id: channelId } = await dm.json();

  // 2) 메시지 전송 (embed 형태)
  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: 'POST', headers: HEADERS(),
    body: JSON.stringify({ embeds: [message.embed] }),
  });
  if (res.status === 429) return backoffOrFail(res, ...);
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === 50007) return { channel:'discord', ok:false, reason:'blocked' };
  }
  return { channel: 'discord', ok: res.ok, reason: res.ok ? undefined : 'error' };
}
```

**DM 메시지 포맷 (embed)**

| Event | Title | Description | Fields/Action |
|-------|-------|-------------|---------------|
| finished | ✅ 자막 생성 완료 | `{영상명}` 자막이 준비됐어요 | `[다운로드]` (signed URL, 24h) |
| failed | ⚠️ 자막 생성 실패 | `{영상명}` 처리 중 문제가 생겼어요 (`{errorCode}`) | `[다시 시도]` (retryUrl) |

> 자막 본문·텍스트는 절대 포함하지 않음 (N-06). 링크만.

### 4.5 Dispatcher (services/notify/index.ts)

```typescript
export async function dispatchNotify(event: NotifyEvent): Promise<NotifyResult[]> {
  const profile = await getUserProfile(event.userId);          // admin client
  const channel: NotifyChannel = profile?.notifyChannel ?? 'email';
  const out: NotifyResult[] = [];

  if (channel === 'email' || channel === 'both')
    out.push(await sendEmail(event));

  const canDiscord = (channel === 'discord' || channel === 'both')
    && !!profile?.discordUserId && !profile.discordDmBlocked;
  if (canDiscord) {
    const r = await sendDiscordDM(profile!.discordUserId!, toDiscordMessage(event));
    out.push(r);
    if (r.reason === 'blocked') await markDmBlocked(event.userId);
    // discord 단독인데 실패 → 이메일 fallback (both는 이미 위에서 발송)
    if (!r.ok && channel === 'discord') out.push(await sendEmail(event));
  }

  await appendJobEvent(event.jobId, 'notified',
    { results: out.map(r => ({ channel: r.channel, ok: r.ok, reason: r.reason })) });
  return out;
}
```

---

## 5. UI/UX Design

### 5.1 마이페이지 — DiscordLinkSection

**미연결 상태**
```
┌─ 알림 설정 ─────────────────────────────────────┐
│  Discord 연결                                    │
│  잡 완료/실패 알림을 Discord DM으로 받아보세요.   │
│  ⚠ 먼저 make_cc Discord 서버에 참여해야 봇이      │
│     DM을 보낼 수 있어요.  [서버 참여하기 ↗]       │
│                                                  │
│            [ Discord 계정 연결 ]                 │
└──────────────────────────────────────────────────┘
```

**연결 상태**
```
┌─ 알림 설정 ─────────────────────────────────────┐
│  ✅ Discord 연결됨  @username      [연결 해제]    │
│  ─────────────────────────────────────────────  │
│  알림 받을 곳                                     │
│   ( ) 이메일만   ( ) Discord DM만   (•) 둘 다     │
│                                                  │
│  ⚠ (조건부) DM이 차단된 것 같아요. Discord 개인   │
│     정보 설정에서 '서버 멤버의 DM 허용'을 켜주세요.│
└──────────────────────────────────────────────────┘
```

### 5.2 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `DiscordLinkSection` | `features/account/` | 연결 상태 분기 + 연결/해제 버튼 + 알림 토글 + 차단 배지 |
| `NotifyChannelToggle` | `features/account/` | email/discord/both 라디오 (연결 시만 활성) |
| `DiscordInviteLink` | `components/` (header/footer) | `DISCORD_INVITE_URL` 노출 (NEXT_PUBLIC) |

### 5.3 User Flow

```
1. 마이페이지 진입 → getUserProfile로 연결 상태 로드
2. (미연결) "Discord 계정 연결" → 서버 참여 안내 확인 → linkDiscord()
   → window.location = url → Discord 동의 → /auth/discord/callback
   → /account?discord=linked → "연결됨" + 토글 노출
3. 알림 경로 라디오 변경 → setNotifyChannel() (낙관적 업데이트 + 실패 시 롤백)
4. (DM 차단 감지 시) discord_dm_blocked=true → 배지 표시 + 안내
5. "연결 해제" → unlinkDiscord() → 토글 숨김 + email 강등
```

---

## 6. Error Handling

### 6.1 에러 코드

| Code | HTTP | 사유 |
|------|:-:|------|
| `DISCORD_LINK_FAILED` | 502 | linkIdentity / 콜백 교환 실패 |
| `NOT_LINKED` | 409 | 미연결 상태에서 discord/both 선택 |
| `UNAUTHORIZED` | 401 | 비로그인 server action 호출 |
| (내부) `rate_limited` | — | Discord 429 (3회 backoff 후 실패) |
| (내부) `blocked` | — | Discord 50007 (DM 차단) → 이메일 fallback |

### 6.2 알림 실패 정책

| 상황 | 처리 |
|------|------|
| Discord 미참여 사용자 (DM 채널 개설 실패) | `reason:'error'` → channel='discord'면 이메일 fallback. 마이페이지 안내 유지 |
| 50007 DM 차단 | `discord_dm_blocked=true` 영구 마크 → 이후 dispatch는 Discord 건너뜀 + 이메일. 배지로 사용자 유도 |
| 429 rate limit | retry-after 헤더 기반 sleep 후 최대 3회. 초과 시 fallback |
| Bot 토큰 무효(401) | 로그 critical + 이메일 fallback (운영자 알림 대상) |
| 양쪽(both) 한쪽만 실패 | 성공한 채널은 유지, 실패는 `notified` 이벤트에 기록. both에서는 추가 fallback 안 함 |

### 6.3 멱등성

- 잡당 알림은 상태 전이 1회에 1회 dispatch. 워커 재시도로 동일 전이가 중복 호출될 수 있으므로 `job_events`에 `notified`가 이미 있으면 skip (멱등 가드).

---

## 7. Security Considerations

- [x] **Bot 토큰 비밀**: `DISCORD_BOT_TOKEN`은 워커/서버 env만. `NEXT_PUBLIC_` 접두사 금지. 클라이언트 번들 grep 0건 검증 (N-03).
- [x] **DM 본문 프라이버시**: 자막 원문·텍스트 미포함, signed 다운로드 링크만 (N-06).
- [x] **CSRF**: linkIdentity OAuth는 Supabase 기본 state/PKCE. 콜백은 code 교환만 (N-05).
- [x] **인가**: 모든 server action은 `getUser()`로 본인 확인 후 본인 row만 수정 (RLS + 앱 이중).
- [x] **service_role 보호**: 워커의 profile 조회/마크는 admin client, 서버 라우트는 user 컨텍스트.
- [x] **콜백 경로 분리**: `/auth/discord/callback` ≠ `/auth/callback` → 매직링크 흐름 무간섭.
- [x] **봇 권한 최소화**: Send Messages + DM only. Read Message History / 관리 권한 OFF.
- [x] **rate limit 방어**: 429 backoff로 봇 토큰 일시 정지 회피.

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| Unit | `dispatchNotify`: email/discord/both 분기 매트릭스 | Vitest |
| Unit | `dispatchNotify`: discord 단독 실패 → 이메일 fallback | Vitest |
| Unit | `dispatchNotify`: 멱등 가드 (notified 존재 시 skip) | Vitest |
| Unit | `sendDiscordDM`: 2-step 성공 / 429 backoff / 50007 blocked (fetch mock) | Vitest |
| Unit | `setNotifyChannel`: 미연결 시 discord/both → NOT_LINKED | Vitest |
| Unit | `toDiscordMessage`: 자막 원문 미포함 검증 | Vitest |
| Integration | callback route: identity → user_profiles upsert (supabase mock) | Vitest |
| E2E (수동) | 실제 봇으로 본인 Discord DM finished/failed 수신 | manual |
| E2E (수동) | DM 차단 상태 → 배지 + 이메일 fallback | manual |

### 8.2 Test Cases (Critical)

- [ ] channel='email' → sendEmail 1회, sendDiscordDM 0회
- [ ] channel='both' + linked → email + discord 각 1회
- [ ] channel='discord' + linked + DM 성공 → discord 1회, email 0회
- [ ] channel='discord' + DM 실패(error) → discord 1회 + email fallback 1회
- [ ] channel='discord' + 50007 → blocked 마크 + email fallback + 이후 dispatch는 discord skip
- [ ] dm_blocked=true 상태 → discord 영구 skip, email만
- [ ] 미연결(discord_user_id null) + channel='both' → email만 (canDiscord=false)
- [ ] 429 → retry-after만큼 대기 후 재시도, 3회 초과 시 fallback
- [ ] notified 이벤트 이미 존재 → dispatch skip (멱등)
- [ ] DM embed에 cue/자막 텍스트 문자열 미포함

---

## 9. Clean Architecture (Option C 매핑)

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI, 토글 | `features/account/{DiscordLinkSection, NotifyChannelToggle}`, `components/DiscordInviteLink` |
| **Application** | 서버 액션, 라우트, dispatch | `services/auth/discord.ts`, `app/auth/discord/callback/route.ts`, `services/notify/index.ts` |
| **Domain** | 타입, 메시지 변환(pure) | `types/user.ts`, `services/notify/format.ts (toDiscordMessage)` |
| **Infrastructure** | Discord REST, Resend, Supabase | `services/notify/discord.ts`, `services/notify/email.ts`, `lib/supabase/{server,admin}`, `lib/env` |

### 9.2 Dependency Rules

```
features/account (Presentation)
   │  server action
   ▼
services/auth/discord + services/notify/index (Application)
   │
   ├─▶ services/notify/format (Domain, pure)
   │
   ▼
services/notify/{discord,email} + lib/supabase + lib/env (Infrastructure)
```

- `app/` 라우트는 `services/*`만 import (CLAUDE.md 경계 준수). `lib/resend`/`lib/supabase/admin` 직접 import 안 함.
- 워커는 `services/notify.dispatchNotify` 재사용 — 분기 로직 단일화.

---

## 10. Coding Convention Reference

### 10.1 Naming / Types

| Target | Rule |
|--------|------|
| NotifyChannel | `'email' \| 'discord' \| 'both'` (DB text + check + zod enum) |
| Discord ID 필드 | `discord_user_id` (snake, DB) / `discordUserId` (camel, TS) |
| 콜백 경로 | `/auth/discord/callback` (매직링크와 분리) |
| 이벤트 타입 | `notified` (job_events) |

### 10.2 Environment Variables

| Variable | Scope | Public? | Purpose |
|----------|-------|:-------:|---------|
| `DISCORD_BOT_TOKEN` | Worker + Server | ✗ | 봇 DM REST 인증 |
| `DISCORD_OAUTH_REDIRECT_URL` | Server | ✗ | linkIdentity redirectTo |
| `DISCORD_INVITE_URL` | Public | ✓ (`NEXT_PUBLIC_`) | 서버 초대 링크 |
| `DISCORD_GUILD_ID` | Server | ✗ | (옵션) 참여 여부 점검 |

모두 `lib/env.ts` Zod 스키마에 추가. `process.env` 직접 사용 금지.

### 10.3 Import 경계

기존 `eslint.config.mjs` `no-restricted-imports` 유지:
- `app/` → `services/*`, `lib/env`, `lib/api`, `lib/supabase/server`만
- Discord REST·Resend·admin client는 `services/notify`, `services/auth` 내부에서만 호출

---

## 11. Implementation Guide

### 11.1 File Structure (변경/신규)

```
make_cc/
├── src/
│   ├── app/
│   │   ├── auth/discord/callback/route.ts      (NEW)
│   │   └── (member)/account/page.tsx           (수정 — 섹션 마운트)
│   ├── services/
│   │   ├── notify/
│   │   │   ├── index.ts                        (NEW/수정 — dispatchNotify)
│   │   │   ├── discord.ts                      (NEW — REST DM)
│   │   │   ├── email.ts                        (수정 — sendEmail 래핑)
│   │   │   └── format.ts                       (NEW — toDiscordMessage, pure)
│   │   └── auth/
│   │       └── discord.ts                      (NEW — link/unlink/profile/setChannel)
│   ├── features/account/
│   │   ├── DiscordLinkSection.tsx              (NEW)
│   │   └── NotifyChannelToggle.tsx             (NEW)
│   ├── components/
│   │   └── DiscordInviteLink.tsx               (NEW)
│   ├── types/
│   │   └── user.ts                             (NEW — UserProfile, NotifyChannel, NotifyEvent)
│   └── lib/
│       └── env.ts                              (수정 — Discord env 4종)
├── worker/
│   └── transcribe.ts (또는 jobs.markFinished/Failed 경로)  (수정 — dispatchNotify 호출)
├── supabase/migrations/
│   └── 20260616000001_user_profiles_discord.sql (NEW)
├── docs/operations/
│   └── discord-setup.md                        (NEW — 서버 Option C + 봇 권한 + 사용자 가이드)
├── .env.example                                (수정)
└── tests/unit/services/notify/
    ├── dispatch.spec.ts                        (NEW)
    └── discord.spec.ts                         (NEW)
```

### 11.2 Implementation Order

1. [ ] **DB + 타입 + env**: user_profiles 마이그레이션 + RLS + `types/user.ts` + `lib/env.ts` Discord 4종 + `.env.example`
2. [ ] **Notify core**: `notify/discord.ts` + `notify/format.ts` + `notify/email.ts` 래핑 + `notify/index.ts` dispatcher + 단위 테스트
3. [ ] **Auth linking**: `services/auth/discord.ts` (link/unlink/upsert/setChannel) + `app/auth/discord/callback/route.ts`
4. [ ] **Account UI**: `DiscordLinkSection` + `NotifyChannelToggle` + page 통합 + `DiscordInviteLink` 헤더
5. [ ] **Worker 통합**: markFinished/markFailed → `dispatchNotify` + 멱등 가드
6. [ ] **운영 셋업 + 문서**: Discord Application/Bot 생성, Supabase provider 활성화, Option C 서버 구조, `discord-setup.md`

### 11.3 Session Guide

> Auto-generated. Use `/pdca do discord-integration --scope module-N`.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| DB + Types + Env | `module-1` | `user_profiles` 마이그레이션(RLS + check + updated_at 트리거) + `types/user.ts`(UserProfile/NotifyChannel/NotifyEvent/NotifyResult) + `lib/env.ts` Discord env 4종 + `.env.example` | 15-20 |
| Notify Core | `module-2` | `notify/discord.ts`(REST 2-step + 429 backoff + 50007) + `notify/format.ts`(toDiscordMessage, 자막 원문 미포함) + `notify/email.ts` 래핑 + `notify/index.ts` dispatcher(분기 + 멱등 가드 + job_events) + `dispatch.spec.ts`/`discord.spec.ts` | 30-35 |
| Auth Linking | `module-3` | `services/auth/discord.ts`(linkDiscord/unlinkDiscord/setNotifyChannel/getUserProfile/upsert) + `app/auth/discord/callback/route.ts`(code 교환 + identity 추출 + profile upsert) + 콜백 분리 검증 | 25-30 |
| Account UI | `module-4` | `DiscordLinkSection`(연결/미연결/차단 3분기) + `NotifyChannelToggle`(낙관적 업데이트) + `(member)/account/page.tsx` 통합 + `DiscordInviteLink` 헤더/푸터 | 25-30 |
| Worker 통합 | `module-5` | markFinished/markFailed 뒤 `dispatchNotify({jobId,userId,type,payload})` 호출 + 멱등 가드(notified 존재 시 skip) + signed download URL 생성 연결 | 15-20 |
| 운영 셋업 + 문서 | `module-6` | Discord Developer Portal Application/Bot 생성·토큰 발급, Supabase Dashboard Discord provider 활성화 + 콜백 URL 등록, Option C 서버 채널/역할 생성 + 봇 초대, `docs/operations/discord-setup.md` | 20-25 (대부분 운영) |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 25-30 (완료) |
| Session 2 | Do | `--scope module-1,module-2` (DB + Notify core) | 45-55 |
| Session 3 | Do | `--scope module-3,module-4` (Auth + UI) | 50-60 |
| Session 4 | Do + Check | `--scope module-5,module-6` + `/pdca analyze` | 35-45 |

**병목 식별**: module-6의 운영 사전작업(Bot 토큰·Supabase provider 활성화)이 선행되지 않으면 module-2의 실제 DM E2E와 module-3의 OAuth 콜백을 검증할 수 없음. **사용자 사전 작업** (Session 2 시작 전 권장):

```
1. https://discord.com/developers/applications → New Application (make-cc-bot)
2. Bot 탭 → Reset Token → DISCORD_BOT_TOKEN 확보 (Send Messages만, 나머지 OFF)
3. OAuth2 → Redirects에 {SITE_URL}/auth/discord/callback 추가
4. Supabase Dashboard → Authentication → Providers → Discord 활성화
     (Client ID/Secret = Discord OAuth2 앱 값), Redirect URL 등록
5. make_cc Discord 서버 생성 + Option C 채널/역할(§Plan 7.5) + 봇 초대(scope=bot)
6. .env: DISCORD_BOT_TOKEN / DISCORD_OAUTH_REDIRECT_URL / NEXT_PUBLIC_DISCORD_INVITE_URL
```

> **linkIdentity 주의**: Supabase 프로젝트에서 **Manual Linking**이 활성화돼 있어야 `linkIdentity` 사용 가능 (Dashboard → Authentication → 설정). 비활성 시 module-3에서 막힘 — 사전 확인 항목.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-06-15 | Initial draft — Option C(Pragmatic) 선정, dispatcher 단일화 + linkIdentity 콜백 + REST DM, 6 모듈/4 세션 권장 | shong7500 |
