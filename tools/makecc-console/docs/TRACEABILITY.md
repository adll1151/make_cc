# MAKECC Control Center — 요구사항 추적표 (Traceability Matrix)

**요구사항 → 구현 컴포넌트 → 테스트 케이스** 연결. 인수 기준 검증용.

| 요구사항 | 구현 컴포넌트 (파일) | 단위(UT) | 통합/UAT/장애 |
|----------|---------------------|----------|----------------|
| **R1 Event Timeline** | `EventHub` (Events/Events.cs) · `DashboardView.Timeline` | UT-001a/b/c | IT-006, UAT-003 |
| **R2 Diagnostics** | `IServiceMonitor` + 환경체크 (Diagnostics/Diagnostics.cs) · `DiagnosticsScreen` | UT-010a/b | IT-010, UAT-006, FT-005 |
| **R3 Crash Report** | `CrashReport.BuildMarkdown/Generate` (Reports/CrashReport.cs) | UT-023a/b | UAT-008, FT-009, FT-010 |
| **R4 Audit Log** | `AuditLog` (Logging.Audit.cs) · `AppServices.RecordUserAction` | UT-020c | IT-009, UAT-006/009 |
| **R5 Notification Center** | `EventHub.Notifications` · `DashboardView.Notifications` | UT-001b | IT-006, UAT-003 |
| **R6 Session 정보** | `SessionStats` (Events.cs) · `DashboardView.SessionBar` | — | UAT-012 |
| **R7 Metrics History (Sparkline)** | `MetricsHistory` (Events.cs) · `DashboardView.SparkLine` | UT-003a | IT-005 |
| **R8 Update Checker** | `UpdateChecker` (Update/UpdateChecker.cs) | UT-012a/b | IT-011, UAT-011(테마와 별개 config) |
| **R9 Command Palette** | `CommandRegistry` (Commands/Commands.cs) · `CommandPalette` | UT-011a/b | UAT-007 |
| **R10 Themes** | `Theme`/`Palettes` (Theme.cs) · `LauncherConfig.Theme` | UT-005a/b/c, UT-021b | UAT-011 |
| **R11 서비스 확장성** | `IServiceMonitor` + `AppServices.Monitors` · `MonitorLoop` | UT-010a/b | IT-002/003/004 |
| **R12 로그 구조/보관** | `FileLogger`(6계층) · `LogArchiver` (Logging.Audit.cs) | UT-020a/b/c | IT-007, FT-006 |
| Splash / Startup Summary | `SplashScreen` · `StartupReport` | UT-004a | IT-001, UAT-001 |
| Dashboard / 멀티뷰 | `DashboardView` · `DashboardScreen` | — | IT-005/008, UAT-013 |
| History (실행 이력) | `HistoryStore` (History.cs) | UT-022a/b/c | IT-001(Summary→이력) |
| Log Writer | `LogBus` + `FileLogger` | UT-002a/b, UT-020a/b | IT-007 |
| 설정 파일 | `LauncherConfig` (Config/LauncherConfig.cs) | UT-021a/b | UAT-011, FT-008 |
| 서비스 기동/종료 | `ProcessManager` | — | IT-003/009, UAT-010, FT-002/007 |

## 커버리지 요약
- 요구사항 **R1~R12 전부** 최소 1개 테스트 케이스 연결.
- 단위 테스트 자동화: 순수 로직(EventHub·Theme·History·Config·Report빌더·UpdateChecker·Monitor·LogWriter) = **UT 31 케이스**.
- 프로세스/렌더/도커 등 외부 의존은 IT/UAT/FT 시나리오로 커버(일부 `--selftest/--diagnostics/--check-updates`로 자동).
- 미자동(수동 확인): 실제 렌더 시각 확인(UAT-006/007), 종료 애니메이션(UAT-010), 테마 색상 육안(UAT-011).
