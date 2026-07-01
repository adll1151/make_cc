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
- **Main 뷰** (`F1`) — 헤더(로고·상태·**Update**·**Notification Center**) / Services / System(+**Sparkline**) / **Event Timeline** / **Session** / Live Log
- **History 뷰** (`F6`) — Containers / Latest Deployment / Recent / Failed Launches
- **Diagnostics** (`F9`) — 서비스+환경 11종 점검(✓/✗ + 원인)
- **Command Palette** (`Ctrl+Shift+P`) — 모달, 타이핑 필터. 재시작·로그·리포트·진단·업데이트·종료 등
- **Shutdown** — 서비스 역순 정지 애니메이션

### 단축키
`F1` Main · `F6` History · `F2` Restart · `F9` Diagnostics · `Ctrl+Shift+P` Palette · `F4` Browser · `ESC` Exit

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
  "update": { "enabled": true, "repo": "adll1151/make_cc" }
}
```

- **theme**: `dark`(기본) · `nord` · `dracula` · `catppuccin` · `gruvbox`
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
| 업데이트 | `Update/UpdateChecker` | GitHub Releases 비교 |
| 리포트 | `Reports/CrashReport` | Markdown 보고서 |
| 테마 | `Theme` | 교체 가능한 Palette |
| 화면 | `Screens/*` | Splash / Dashboard / Diagnostics / Palette / Shutdown |

**확장 예시**
- 새 서비스: `Services/Monitors`에 `IServiceMonitor` 구현 1개 → 대시보드·진단·이벤트 자동 반영
- 새 명령: `CommandRegistry.All()`에 1줄 → 팔레트 자동 노출
- 새 테마: `Palettes`에 Palette 1개 + `ByName` 1줄

## 참고

- Queue / Request / Success Rate 는 `Telemetry` 플레이스홀더(코드 TODO) — 실제 BullMQ/API 메트릭으로 교체 예정.
- Docker 미설치/미실행 시 자동 degrade(컨테이너 패널 "disconnected", 앱은 계속 동작).
