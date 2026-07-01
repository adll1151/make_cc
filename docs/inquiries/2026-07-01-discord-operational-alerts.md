# 문의 응답 — Discord 운영 이벤트 알림 연동

| 항목 | 내용 |
|------|------|
| 접수일 | 2026-07-01 |
| 요청자 | 2TS 김성수 과장 |
| 마감 | 2026-07-15 |
| 대상 기능 | 기동완료/오류/장애/복구 등 주요 운영 이벤트의 Discord 알림 (Webhook) |
| **상태 판정** | **① 개발 범위 포함 O / 진행 중 (부분 구현)** |

---

## 0. 요약 (TL;DR)

- **Webhook 기반 Discord 알림 인프라는 구현·배포 완료.** 단, 현재 실제 발송되는 이벤트는 **"장애(워커 다운 → 잡 대기)" 1종**입니다.
- 회의에서 논의된 **기동완료 / 복구 / 처리오류** 알림은 **아직 미착수** — 전체 Notification Matrix 기준 **약 1/4 구현**.
- 나머지 3종 + 테스트/문서는 **7/15 마감 내 반영 가능**하며 **예상 소요 2~3일**.

> 참고(혼동 방지): 본 건과 **별개로**, 사용자 대상 **잡 완료/실패 Discord DM**(봇 기반)은 이미 100% 구현+테스트 완료 상태입니다. 본 문의는 그와 다른 **운영자용 시스템 알림(Webhook)**에 대한 답변입니다.

---

## 1. Discord 연동 방식 및 구성도

**방식: Discord Incoming Webhook** (봇 상주 프로세스 없음. `fetch` POST 1회)
- 상주 Gateway/디스코드봇 불필요 → 서버리스(Vercel) 함수에서 그대로 호출 가능
- 인증: 채널별 Webhook URL 1개 (`DISCORD_WORKER_ALERT_WEBHOOK`)
- 코드: `src/services/notify/worker-alert.ts`

```
[업로드 완료 API]  src/app/api/uploads/[uploadId]/complete/route.ts
        │  잡이 queued 로 생성됨
        ▼
maybeAlertWorkerDown(jobId)   ── services/notify/worker-alert.ts
        │
        ├─ (1) 워커 생존 판정: Storage 하트비트(_system/worker-heartbeat.json)
        │        · 45초 이내 갱신 → "살아있음" → 알림 생략
        │        · poll-loop 워커가 ~15초마다 하트비트 기록
        │
        ├─ (2) 버스트 중복 제거: 최근 10분 내 다른 queued 잡 있으면 생략(1회만)
        │
        └─ (3) 발송: POST DISCORD_WORKER_ALERT_WEBHOOK  { content }
                    │
                    ▼
             [Discord 채널 메시지]
```

- **절대 throw 안 함**: 알림 실패가 업로드/잡 흐름을 막지 않음 (부수효과)
- 자막 원문 등 민감정보 미포함 (제목/링크만)

---

## 2. 알림 대상 이벤트 목록 (Notification Matrix)

| # | 이벤트 | 상태 | 트리거 위치 | 조건 |
|---|--------|:----:|------------|------|
| 1 | **장애 — 워커 다운/잡 대기** | ✅ 구현·배포 | `uploads/[id]/complete` → `maybeAlertWorkerDown` | queued 잡 발생 + 하트비트 stale(>45s) + 10분 dedup |
| 2 | **기동 완료 — 워커 기동** | ❌ 미착수 | (예정) `worker/cli/poll-loop.ts` 시작부 | 워커 poll-loop 부팅 시 1회 |
| 3 | **복구 — 워커 재가동** | ❌ 미착수 | (예정) 하트비트 stale→fresh 전이 감지 | 다운 알림 후 재가동 감지 시 1회 |
| 4 | **처리 오류 — 잡 실패(시스템)** | ❌ 미착수 | (예정) `services/jobs` markFailed 후 | STT/렌더 실패 등 운영 관점 오류 |

> 현재 **1번만** 실제 동작. 2~4번은 아래 §7 범위에 포함.

---

## 3. 전송 메시지 예시

### (현재 실동작) 장애 — 워커 다운
```
🔔 자막 요청이 들어왔어요 — 워커를 켜주세요.
`제품소개영상.mp4` 가 큐에서 대기 중입니다. PC에서 `npm run worker:poll`을 실행하면 처리됩니다.
https://makecc.vercel.app/jobs
```

### (제안 초안) 기동 완료
```
✅ 워커 기동 완료
poll-loop 워커가 온라인입니다. 대기 중인 잡을 처리합니다.
```

### (제안 초안) 복구
```
♻️ 워커 복구됨
다운 상태에서 재가동되었습니다. 적체된 잡 N건 처리를 시작합니다.
```

### (제안 초안) 처리 오류
```
⚠️ 잡 처리 실패
`회의록.mp4` (job 7f3a…) STT 단계에서 실패했습니다. 사유: <errorCode>
https://makecc.vercel.app/jobs
```

---

## 4. Discord 연동 설정 방법

1. Discord 서버 → 알림 받을 **채널** → 톱니(채널 설정) → **연동(Integrations)** → **웹후크** → **새 웹후크**
2. 이름 지정(예: `make_cc-ops`) → **웹후크 URL 복사**
3. 배포 환경 변수에 등록:
   ```
   DISCORD_WORKER_ALERT_WEBHOOK="https://discord.com/api/webhooks/xxx/yyy"
   ```
   - 로컬: `.env` (`.env.example`에 항목 존재)
   - 운영: Vercel → Project → Settings → Environment Variables
4. **미설정 시**: `isWorkerAlertEnabled()`가 false → 알림 기능 자동 비활성(무해). 즉 설정만으로 on/off.
5. 검증: dev 서버에서 워커(poll-loop) 끈 상태로 영상 업로드 → 채널에 알림 1건 수신 확인.

---

## 5. 테스트 시나리오 및 결과

> 현재 전용 자동화 테스트 없음(수동 검증 대상). 아래는 검수용 시나리오 표 — §7 작업 시 Vitest 단위테스트로 자동화 예정.

| # | 시나리오 | 기대 결과 | 현재 |
|---|----------|----------|:----:|
| T1 | 워커 off + 업로드 완료(queued) | 웹훅 알림 1건 발송 | 수동확인 대상 |
| T2 | 워커 on(하트비트 fresh) + 업로드 | 알림 **미발송**(생존 판정) | 수동확인 대상 |
| T3 | 워커 off 상태에서 잡 여러 건 연속 | 10분 내 알림 **1건만**(dedup) | 수동확인 대상 |
| T4 | `DISCORD_WORKER_ALERT_WEBHOOK` 미설정 | 알림 비활성(무해, 로그 없음) | 로직상 보장 |
| T5 | 웹훅 URL 오류/네트워크 실패 | 잡 흐름 정상, 경고 로그만 | 로직상 보장(throw 안 함) |

**운영 준비 체크**: 실제 발송 E2E 1회(T1) + 운영 채널 웹훅 URL 등록이 최종 검수 항목.

---

## 6. 관련 파일/커밋

- 구현: `src/services/notify/worker-alert.ts`
- 트리거: `src/app/api/uploads/[uploadId]/complete/route.ts`
- 하트비트: `src/lib/storage.ts` (`putWorkerHeartbeat`/`getWorkerHeartbeatTs`), `worker/cli/poll-loop.ts`
- env: `src/lib/env.ts` `DISCORD_WORKER_ALERT_WEBHOOK`, `.env.example`
- 커밋: `cdf2e65 feat(notify): 워커 다운 시 Discord 웹훅 알림 (셀프호스팅 폴링 워커용)`

---

## 7. 남은 범위 & 7/15 반영 가능 여부

**반영 가능 — 예상 소요 2~3일** (기존 Webhook 인프라 재사용).

| 작업 | 내용 | 예상 |
|------|------|:----:|
| 기동완료 알림 | poll-loop 부팅 시 웹훅 1회 | 0.5일 |
| 복구 알림 | 하트비트 stale→fresh 전이 감지 후 1회 | 0.5~1일 |
| 처리오류 알림 | markFailed 후 운영 웹훅(사용자 DM과 분리) | 0.5일 |
| 테스트 자동화 + 문서 | T1~T5 Vitest + 설정 가이드 확정 | 0.5일 |

> 선행 필요(운영): 최종 검수용 **운영 채널 Webhook URL 발급 + Vercel 환경변수 등록**. 이것만 되면 실발송 E2E까지 마감 내 완료 가능.

**권장 회신**: "① 포함·진행 중 — Webhook 인프라 + 장애 알림 1종 완료, 나머지 3종(기동/복구/오류)은 7/15까지 추가 반영, 소요 2~3일."
