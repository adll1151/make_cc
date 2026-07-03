# MAKECC Control Center — UI 전면 개편 + 기능 추가 (2026-07-03)

## UI 개편 (k9s / lazygit 스타일)

- **Figlet 로고 헤더(8줄) → 컴팩트 헤더(3줄)**: 브랜드 바 + 탭(F1/F6/F7, 활성 탭 하이라이트) + 우측 상태 클러스터(ONLINE·버전·branch@commit·docker·watchdog·update·시계). 콘텐츠 영역 5줄 확보.
- **푸터**: 테두리 패널 → 무테두리 1행 키바(키캡 스타일 배지). 탭별 컨텍스트 키 표시.
- **Services 패널**: 상태별 아이콘(● ◐ ✖ ○) + detail 컬럼 추가 (예: `:3000 · 12ms`).
- **Event Timeline**: source 태그 표시, 표시 건수 9→11. 기존 헤더의 Notification Center 는 Timeline 에 통합(같은 EventHub).
- **Session 바**: Watchdog ON/OFF 필드 추가.

## 신규 기능

| # | 기능 | 키 | 설명 |
|---|------|----|------|
| #17 | **Logs 뷰** | `F7` | 로그 브라우저. `L` 레벨 필터(ALL→WARN+→ERROR 순환), `Space` 일시정지/재개(스냅샷 고정), LIVE/PAUSED 배지 |
| #14 | **Watchdog 자동 복구** | `F8` 토글 | 이 세션에서 기동한 dev/worker 가 죽으면 자동 재기동. `windowMinutes`(기본 5) 내 `maxRestarts`(기본 3) 초과 시 수동 개입 요구 이벤트 1회 발행 후 중단 |
| #16 | **API Latency 모니터** | — | `:3000` TCP 연결 시간 실측. System 패널에 수치 + 최대값 정규화 스파크라인. 임계 <100ms/<300ms |
| #15 | **Discord 웹훅 알림** | — | 서비스 Down/Recover·워치독 이벤트를 웹훅 통보. config `notify.discordWebhookUrl` → 없으면 `.env` `DISCORD_WORKER_ALERT_WEBHOOK` 폴백 → 둘 다 없으면 완전 비활성. 서비스별 쿨다운(기본 60s) |
| #13 | **테마 순환** | `T` | tokyonight 팔레트 추가(총 6종). 전환 즉시 `makecc.config.json` 에 저장 |

커맨드 팔레트에도 `Toggle Watchdog` / `Cycle Theme` 노출.

## 설정 (makecc.config.json — 기존 파일은 기본값으로 자동 보강)

```json
{
  "watchdog": { "enabled": true, "maxRestarts": 3, "windowMinutes": 5 },
  "notify": { "discordWebhookUrl": "", "cooldownSeconds": 60 }
}
```

## 코드 변경

- 신규: `Services/Watchdog.cs`, `Services/DiscordNotifier.cs`, `Tests/FeatureTests.cs`(UT-020~023, 12케이스)
- 수정: `DashboardView.cs`(재작성), `DashboardScreen.cs`(F7/F8/T/L/Space), `AppServices.cs`(배선 + MonitorLoop 워치독/latency/알림), `Monitors.cs`(ApiMonitor latency), `MetricsProvider.cs`(Net.PortLatency), `Theme.cs`(tokyonight + CycleNext), `Models.cs`/`Events.cs`(LatencyMs·히스토리), `LauncherConfig.cs`, `Commands.cs`, `SelfTest.cs`, `README.md`
- 하위 호환: `DashboardView.Build(state)` 시그니처 유지(--selftest 무변경), 기존 테스트 전부 영향 없음, 기존 config 파일 그대로 동작

## 검증 방법 (Windows, .NET 8)

```bat
dotnet build tools\makecc-console\MakeccConsole.csproj
dotnet test  tools\makecc-console.Tests\MakeccConsole.Tests.csproj
makecc --selftest    :: 새 대시보드 1프레임 렌더 확인
```

---

# 2차 — 클라이언트 요구 5건 (2026-07-03)

| # | 요구사항 | 키 | 구현 |
|---|---------|----|------|
| 1 | **Maintenance Mode** (#18) | `F5` | 저장소 루트 `maintenance.lock` 생성(신규 요청 차단 신호) → Draining(진행 중 잡 완료 대기, Queue의 transcribing=0 판정) → Idle(안전 정지 가능) → 해제 시 lock 삭제·재개. 각 단계 이벤트+Discord 통보. 이전 세션 lock 잔존 시 시작할 때 점검 상태 자동 복원. **API 연동 지점**: Next.js 잡 생성 핸들러에서 lock 파일 존재 시 503 — 1줄 |
| 2 | **Queue 관리** (#19) | `Q` 뷰 | Supabase PostgREST(service role)로 `jobs` 테이블 직접 관리. `↑↓` 선택, `R` Retry(failed→queued, 에러 리셋), `C` Cancel(queued/pending→cancelled), `P` 맨 앞(created_at=head−1s), `B` 맨 뒤(now). 상태 가드로 진행 중 잡 보호. 6초 주기 자동 갱신, 실제 대기 수가 System 패널 Queue 지표 대체(기존 placeholder 제거). `.env` 미설정 시 안내 패널로 degrade |
| 3 | **System Snapshot Export** (#20) | `S` | `logs/snapshots/snapshot-*.zip` — makecc.config.json + 전체 진단 실행 결과 + state.json(서비스/컨테이너/지표/세션/큐/이벤트 50건/건강이력) + 당일 runtime·error·audit 로그 + 최신 startup 로그 + 최근 리포트 3건 + history.json. 비차단 실행 |
| 4 | **Health History** (#21) | `F6` 뷰 내 | Service Health 패널 — 서비스별 세션 가동률 %, Ok→Error 전이 횟수, 최근 90초 상태 스트립(틱당 1칸 색상), 마지막 다운 시각. Restart/Recovery 는 기존 Session 바와 병행 |
| 5 | **Config Editor** (#22) | `E` | 모달 편집기 — Theme(선택)·Watchdog(on/off, 한도, 윈도우)·Discord Webhook·쿨다운·로그 보관 2종·업데이트 2종. 작업 사본 편집 → Save 시에만 파일 저장+런타임 즉시 반영(테마/워치독/Notifier 재구성), Cancel 시 파기 |

추가 테스트: UT-024(점검 5), UT-025(건강이력 3), UT-026(큐 가드 2) — 누적 22케이스.
