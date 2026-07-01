# Plan — first-party 분석 (퍼널)

> 상태: Do 착수 (2026-07-01). 결정 근거: 외부 SaaS(PostHog 등) X → Supabase에 직접 적재($0·데이터 소유), **퍼널만 한정**.

## 왜

"실사용자 확보"를 하려면 **어디서 이탈하는지**가 보여야 한다. 계기판 없이 랜딩·편집기를 다듬는 건 감으로 찍는 것. 이 기능은 폴리싱/사용자확보의 계기판.

## 범위 (MVP)

핵심 퍼널만 계측한다. 세부 히트맵·세션 리플레이·A/B는 범위 밖.

```
page_view → upload_started → upload_completed(잡 생성) → job_finished → editor_opened → srt_downloaded
```

## 설계

| 레이어 | 구현 |
|--------|------|
| DB | `analytics_events`(append-only). RLS: 조회 정책 없음 = 운영자(service_role)만. 마이그 `20260701000001` |
| 타입 | `types/analytics.ts` — `ANALYTICS_EVENTS` allowlist + Zod 배치 스키마 |
| 서비스 | `services/analytics` — `recordAnalyticsEvents`(admin insert, 실패해도 throw 안 함) |
| API | `POST /api/analytics` — 얇은 컨트롤러, Zod 검증 + 소유자(회원/게스트) 서버 결정 |
| 클라 | `lib/analytics.ts` `track()` — sendBeacon 우선, sessionStorage `mcc_sid` |
| 트래커 | `features/analytics/AnalyticsTracker` — 라우트 변경마다 page_view (layout에 1회 마운트) |
| 리포트 | `npm run funnel [일수]` — `scripts/analytics-funnel.mjs` (퍼널·유입경로·인기페이지) |

## 원칙

- **신원은 서버가 결정**(회원=user_id, 게스트=mcc_anon). 클라는 세션ID만 보냄 → 위조 방지.
- **분석은 부가 기능**: 어떤 실패도 사용자 흐름을 막지 않는다(무음 무시).
- **퍼널만**: 이벤트 allowlist로 스키마 오염 방지. 새 단계 = 이벤트명 1개 + `track()` 1줄.

## 다음 (범위 밖, 후속 후보)

- 운영자 대시보드 페이지(`/admin/analytics`) — 현재는 CLI로 조회
- 일자별 롤업 테이블 + 코호트/리텐션
- Queue/Request/성공률 등 처리 지표 연동
