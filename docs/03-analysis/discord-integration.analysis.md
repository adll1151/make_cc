---
template: analysis
version: 1.3
feature: discord-integration
date: 2026-06-15
author: shong7500
project: make_cc
phase: check
matchRate: 93
---

# discord-integration Gap Analysis (PDCA Check)

> 설계 문서(`docs/02-design/features/discord-integration.design.md`) ↔ 실제 구현 코드 대조.
> gap-detector 에이전트 독립 분석 + 런타임 검증 결과 통합.

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Resend 도달률 저하·admin UI 비용·매직링크 외 알림 채널 부재 |
| **WHO** | 영상 크리에이터 회원, Discord 친화 사용자, 운영자 |
| **SUCCESS** | DM 성공률 ≥95%, 연결 전환 ≥30%, 토글 0% 이탈, 자막 프라이버시 |
| **SCOPE** | Phase1: Account Linking + DM 알림(finished/failed) + 서버 셋업 |

---

## Match Rate: **93%** ✅ (≥ 90% → Report 진행 가능)

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match (§2~§11) | 93% | ✅ |
| Plan §10 Success Criteria | 100% (7/7) | ✅ |
| Architecture/Convention 준수 | 95% | ✅ |
| **Critical 갭** | **0건** | ✅ |

### 런타임 검증 (실제 동작 확인됨)
- OAuth linking → `user_profiles` 저장(@w__0.0, discord_user_id) → `notify_channel='discord'` 토글 정상
- typecheck 0 / lint 0 / 단위테스트 130개 통과 (Discord 신규 19개)

---

## Plan §10 Success Criteria — 7/7 충족

| 기준 | 충족 근거 |
|---|---|
| Account Linking 양방향 | `linkDiscord`/`unlinkDiscord` + 콜백 upsert |
| finished/failed DM 라우팅 | `dispatchJobCompleted/Failed` → notify_channel 분기 |
| 토글 즉시 반영 | `setNotifyChannel` upsert + dispatcher 매 발송 시 재조회 |
| 자막 원문 노출 0 | format.ts 제목+링크만 (N-06) |
| Bot 토큰 클라 노출 0 | `DISCORD_BOT_TOKEN` non-public, 서버 전용 (N-03) |
| fallback 정확 1회 | discord 단독 실패 시에만 email (dispatch.ts) |
| 단위 테스트 통과 | discord/dispatch/auth 3 spec, 19 신규 |

---

## Important 갭 (문서 정합 — 코드 정상)

| # | 항목 | 설계 | 구현 | 조치 |
|---|------|------|------|------|
| I-1 | 멱등 가드 주석 | dispatcher 내장 | 코드는 정상 내장(`hasJobEvent`), **주석만** "module-5가 감쌈"으로 모순 | dispatch.ts 주석 수정 |
| I-2 | 이벤트 타입명 | `notify_dispatched` | `notified` (events.ts/job.ts 기존 enum 재사용) | design §3.4/§10.1 명칭 정정 |
| I-3 | 429 backoff 범위 | DM 전송 단계 | 채널개설+전송 **양 단계** 처리 (강화) | design §4.4 명기 |

---

## Minor / 의도적 조정 (모두 타당)

| 항목 | 설계 | 구현 조정 | 근거 |
|------|------|----------|------|
| Server action 반환 | `throw AppError` | `{ok}`\|`{error}` 객체 | prod 에러 마스킹 회피 — UI가 사유 표시 |
| 프로필 write | `createServerSupabase` | `createAdminClient` + 검증 user.id | SSR write 타입 `never` 이슈 회피, 신원은 getUser 확인 |
| updated_at 트리거 | 자동 갱신 | 생략 | SQL Editor dollar-quote 이슈 + 불필요 |
| discord_user_id UNIQUE | 미언급 | partial unique index 추가 | 중복 연결 방지 (설계 초과 개선) |
| discordUserId fallback | `provider_id ?? sub` | `?? identity.id` 추가 | id 누락 방어 |
| 다운로드 링크 | signed URL 임베드 | `/api/subtitles/{id}/download` 라우트 경유 | DM 본문 안정 경로 |

---

## 결론 & 권장 조치

**Critical 0 · Match Rate 93%** → 품질 게이트 통과. 모든 갭은 **문서 측 갱신으로 해소 가능**(코드 수정 불필요). 구현이 설계를 여러 지점에서 **안전하게 강화**(UNIQUE index, 2-step 429, id fallback, 에러 마스킹 회피)했고, 회귀 위험 항목(이메일 경로·콜백 분리·자막 프라이버시)은 모두 보존됨.

**즉시 (문서 정합, 코드 무수정):**
1. design §3.4/§10.1 `notify_dispatched` → `notified`
2. dispatch.ts 헤더 주석 — "module-5에서 감쌈" → "dispatcher 내장"
3. design §4.4(429 2-step) / §3.3(트리거 생략) / UNIQUE index 반영

**잔여 (코드 외):**
- 실제 DM 발송 검증 = `DISCORD_BOT_TOKEN`(리셋본) 입력 후 영상 잡 1회 처리 시 확인 (module-5 런타임)

→ `/pdca report discord-integration`로 완료 보고 진행 권장.

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-15 | gap-detector 분석 + 런타임 검증 통합. Match Rate 93%, Critical 0 |
