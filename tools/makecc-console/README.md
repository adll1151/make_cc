# MAKECC Control Center

MAKECC 서비스(개발 서버 + 워커 + Redis/Docker)를 기동·감시·진단하는 **DevOps TUI 관리 콘솔**.
Spectre.Console 기반. 단순 실행기가 아니라 실제 운영 환경용 Control Center를 지향합니다.

## 실행

```bat
:: 저장소 루트에서
start.bat
```

또는 직접:

```bat
dotnet run -c Release --project tools\makecc-console\MakeccConsole.csproj
```

> 요구: **.NET 8 SDK** (`winget install Microsoft.DotNet.SDK.8`). Windows 전용(`net8.0-windows`).
> 최소 콘솔 크기 118 x 34 (미만이면 크래시 대신 안내). 넉넉히 최대화 권장.

## 화면 (멀티뷰)

- **Splash** — Figlet 로고 + 부트 스피너(Environment→Docker→Containers→Worker→API→Health→Ready) + **Startup Summary**
- **Main 뷰** (`F1`) — 컴팩트 헤더(브랜드·탭·상태 클러스터) / Services / System(**Sparkline**·**API Latency**) / **Event Timeline** / **Session** / Live Log
- **History 뷰** (`F6`) — Containers / Latest Deployment / Recent / Failed Launches
- **Logs 뷰** (`F7`) — 로그 브라우저. `L` 레벨 필터(ALL→WARN+→ERROR) · `Space` 일시정지/재개
- **Queue 뷰** (`Q`) — Supabase `jobs` 대기열 관리. `↑↓` 선택 · `R` Retry(failed) · `C` Cancel(queued) · `P` 맨 앞 · `B` 맨 뒤
- **Config Editor** (`E`) — 설정 파일을 화면에서 편집(테마·워치독·알림·로그 보관·업데이트). 저장 시 즉시 반영
- **Maintenance Mode** (`F5`) — 점검 모드: `maintenance.lock` 생성 → 신규 요청 차단 신호 → 잔여 작업 드레인 → Idle → 해제 시 재개
- **System Snapshot** (`S`) — 설정+진단+상태+당일 로그+크래시 리포트+이력을 `logs/snapshots/*.zip` 으로 패키징
- **Diagnostics** (`F9`) — 서비스+환경 11종 점검(✓/✗ + 원인)
- **Command Palette** (`Ctrl+Shift+P`) — 모달, 타이핑 필터. 재시작·로그·리포트·진단·업데이트·종료 등
- **Shutdown** — 서비스 역순 정지 애니메이션

### 단축키
`F1` Main · `F6` History · `F7` Logs · `Q` Queue · `F2` Restart · `F5` Maintenance · `F8` Watchdog · `S` Snapshot · `E` Config Editor · `F9` Diagnostics · `T` Theme · `Ctrl+Shift+P` Palette · `F4` Browser · `ESC` Exit

### 헤드리스 CLI (서버/CI)
```bat
makecc --diagnostics     :: 전체 점검 결과 출력
makecc --check-updates   :: 현재/최신 버전 비교 (GitHub Releases)
makecc --info            :: 활성 테마/경로
makecc --selftest        :: 대시보드 1프레임 렌더(검증용)
```

## 설정 — `makecc.config.json` (저장소 루트, 자동 생성)

```json
{
  "theme": "dark",
  "logs": { "archiveAfterDays": 7, "retentionDays": 30 },
  "update": { "enabled": true, "repo": "adll1151/make_cc" },
  "watchdog": { "enabled": true, "maxRestarts": 3, "windowMinutes": 5 },
  "notify": { "discordWebhookUrl": "", "cooldownSeconds": 60 }
}
```

- **theme**: `dark`(기본) · `nord` · `dracula` · `catppuccin` · `gruvbox` · `tokyonight` — 대시보드에서 `T` 키로 순환 전환(자동 저장)
- **watchdog**: 이 세션에서 기동한 dev/worker 프로세스가 죽으면 자동 재기동. `windowMinutes` 내 `maxRestarts` 초과 시 수동 개입 요구로 전환(이벤트/알림 1회). `F8` 로 런타임 토글.
- **notify.discordWebhookUrl**: 서비스 Down/Recover·워치독 이벤트를 Discord 웹훅으로 통보. 비우면 `.env` 의 `DISCORD_WORKER_ALERT_WEBHOOK` 폴백, 그것도 없으면 완전 비활성. `cooldownSeconds` 로 서비스별 재알림 억제.
- **logs.archiveAfterDays**: 이보다 오래된 runtime/error 로그를 gzip으로 `archive/` 이동
- **logs.retentionDays**: 이보다 오래된 archive 삭제
- **update.repo**: 최신 버전 비교 대상 GitHub 저장소

## 로그 & 이력

```
logs/
  startup/   startup-YYYY-MM-DD_HHmmss.log   # 기동 1회분
  runtime/   runtime-YYYY-MM-DD.log          # 전체(일자별)
  error/     error-YYYY-MM-DD.log            # ERROR만
  audit/     audit-YYYY-MM-DD.log            # 사용자 작업(재시작·종료 등)
  reports/   report-YYYY-MM-DD-HHmmss.md     # 크래시/실패 자동 보고서
  archive/   *.gz                            # 오래된 로그 압축 보관
  history.json                               # 실행 이력(최근 50, JSON)
  .pids.json                                 # dev/worker PID 추적
```

로그 레벨: `INFO`·`SUCCESS`·`WARNING`·`ERROR`·`DEBUG` (색상 구분).

## 아키텍처 (확장 지점)

| 계층 | 파일 | 역할 |
|------|------|------|
| 상태 | `AppState`, `Models`, `Events` | 화면이 읽는 단일 스냅샷 + 이벤트/세션/지표히스토리 |
| 설정 | `Config/LauncherConfig` | makecc.config.json |
| 로깅 | `Logging`, `Logging.Audit` | 링버퍼 + 6계층 파일 + 감사 + 보관(archiver) |
| 이력 | `History` | LaunchRecord / HistoryStore / StartupReport |
| 모니터 | `Services/Monitors` | **IServiceMonitor** — 서비스 확장 지점 |
| 진단 | `Diagnostics/Diagnostics` | 서비스+환경 체크 |
| 명령 | `Commands/Commands` | **CommandRegistry** — 팔레트/단축키 공유 |
| 워치독 | `Services/Watchdog` | 자동 복구 + 윈도우 한도(#14) |
| 알림 | `Services/DiscordNotifier` | Discord 웹훅 통보(#15) |
| 점검 | `Services/MaintenanceService` | maintenance.lock + 드레인(#18) |
| 큐 | `Services/SupabaseQueueService` | jobs 조회/Retry/Cancel/순서(#19) |
| 스냅샷 | `Services/SnapshotExporter` | 장애 분석 패키지(#20) |
| 건강이력 | `Services/HealthHistory` | 가동률·장애 스트립(#21) |
| 업데이트 | `Update/UpdateChecker` | GitHub Releases 비교 |
| 리포트 | `Reports/CrashReport` | Markdown 보고서 |
| 테마 | `Theme` | 교체 가능한 Palette |
| 화면 | `Screens/*` | Splash / Dashboard / Diagnostics / Palette / Shutdown |

**확장 예시**
- 새 서비스: `Services/Monitors`에 `IServiceMonitor` 구현 1개 → 대시보드·진단·이벤트 자동 반영
- 새 명령: `CommandRegistry.All()`에 1줄 → 팔레트 자동 노출
- 새 테마: `Palettes`에 Palette 1개 + `ByName` 1줄

## 참고

- **Maintenance Mode API 연동**: 콘솔이 저장소 루트에 `maintenance.lock` 을 생성/삭제합니다. Next.js 신규 업로드/잡 생성 핸들러에서 `fs.existsSync('maintenance.lock')` 체크 후 503 응답 1줄만 추가하면 신규 요청 차단이 완성됩니다(파일 기반 — 프레임워크 무관).
- **Queue 관리 동작 원리**: 워커(poll-loop)가 `status='queued'` 중 `created_at` 오래된 순으로 처리하므로, 순서 변경은 `created_at` 조정으로 구현(맨앞=대기열 head−1초, 맨뒤=now). Retry는 `failed→queued`(에러/진행률 리셋), Cancel은 `queued/pending→cancelled` 로 상태 가드가 걸려 있어 진행 중 잡은 건드리지 않습니다.
- 헤더의 Notification Center 는 UI 개편으로 **Event Timeline 에 통합**되었습니다(같은 EventHub 스트림, source 태그 표시).
- **API Latency** 는 `:3000` TCP 연결 시간 실측(스파크라인 포함). 임계: <100ms 정상 · <300ms 경고 · 이상 위험.
- Queue / Request / Success Rate 는 `Telemetry` 플레이스홀더(코드 TODO) — 실제 BullMQ/API 메트릭으로 교체 예정.
- Docker 미설치/미실행 시 자동 degrade(컨테이너 패널 "disconnected", 앱은 계속 동작).
