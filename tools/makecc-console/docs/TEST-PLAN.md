# MAKECC Control Center — 테스트 계획서

대상: `tools/makecc-console` (.NET 8 Spectre.Console TUI 런처)
계층: **단위(UT)** → **통합(IT)** → **인수/UAT** → **장애·예외(FT)**

- 단위 테스트(UT-001~023): `tools/makecc-console.Tests`, 실행 `dotnet test` — 31 케이스 자동.
- 아래 IT/UAT/FT는 시나리오 기반. **[자동]** 표시는 헤드리스 플래그로 검증 가능, 나머지는 운영자 수동.

헤드리스 검증 플래그:
```
makecc --selftest        대시보드 1프레임 렌더
makecc --diagnostics     서비스+환경 11종 점검 결과
makecc --check-updates   현재/최신 버전 비교
makecc --info            활성 테마/경로
```

---

## A. 통합 테스트 (IT) — 서비스 간 연동

| ID | 시나리오 | 절차 | 예상 동작 | 성공 조건 |
|----|----------|------|-----------|-----------|
| **IT-001** | 런처 실행/부트 | `start.bat` 실행 | Splash → Boot 시퀀스(Environment→Docker→Containers→Worker→API→Health→Ready) → Startup Summary → Dashboard | Summary에 Result 표시, Dashboard 진입 |
| **IT-002** | Docker 연결 감지 | Docker Desktop 실행 상태로 기동 | DockerMonitor=Connected, 컨테이너 목록 로드 | 좌측 Services에 Docker ●초록, Containers 테이블 채워짐 |
| **IT-003** | 서비스 기동 (dev/worker) | 부트 시 자동 기동 | `npm run dev`/`worker` 백그라운드 프로세스 생성, PID `logs/.pids.json` 기록 | API/Worker 프로세스 살아있음, 로그 스트리밍 |
| **IT-004** | Health Check | 부트 Health 단계 + 런타임 모니터(1.5s) | API(:3000)·Redis(:6379) 포트 점검, 상태 반영 | Services 패널 상태가 실제 포트 상태와 일치 |
| **IT-005** | Dashboard 표시 | Ready 후 | 헤더/Services/System(+Sparkline)/Timeline/Session/Live Log 렌더, 250ms 갱신 무깜빡 | **[자동]** `--selftest` 출력에 전 패널 존재 |
| **IT-006** | 상태 전이 이벤트 | 서비스 상태 변경(예: worker 재시작) | 전이 감지 → Timeline/Notification 발행, Recovery 카운트 | Timeline에 `X Recovered`/`X Health Failed` 표시 |
| **IT-007** | 로그 생성 | 기동~운영 | `logs/{startup,runtime,error,audit}` 파일 기록 | 해당 파일 생성 + 내용 존재 |
| **IT-008** | 뷰 전환 | `F6`/`F1` | Main ↔ History 뷰 전환 | History에 Containers/Deployment/Recent/Failed |
| **IT-009** | 종료 처리 | `ESC` | Shutdown 애니메이션(Worker→API→Redis→Docker 정지) → 프로세스 종료 | dev/worker 프로세스 종료, audit에 `USER Shutdown` |
| **IT-010** | 진단 통합 | `makecc --diagnostics` | 서비스5 + 환경6 점검 | **[자동]** 11개 항목 OK/FAIL + 원인 출력 |
| **IT-011** | 업데이트 확인 | `makecc --check-updates` | GitHub Releases 조회 | **[자동]** Current/Latest/판정 출력 |

---

## B. 인수 테스트 (UAT) — 운영자 관점

각 항목: **전제 → 조작 → 기대결과**. 운영자가 실제 화면에서 확인.

| ID | 시나리오 | 전제 | 조작 | 기대 결과 |
|----|----------|------|------|-----------|
| **UAT-001** | 정상 기동 | .env·Node 준비 | `start.bat` | Startup Summary=SUCCESS, Dashboard 정상, STATUS=ONLINE |
| **UAT-002** | Docker 미실행 | Docker 종료 상태 | 기동 | 크래시 없이 진행, Docker=Disconnected, "Starting Containers…(skipped)" 로그, 나머지 정상 |
| **UAT-003** | Worker 장애 | worker 비정상 종료 | 관찰 | Worker ●빨강 Stopped, Timeline `Worker Health Failed`, Notification 표시 |
| **UAT-004** | Redis 장애 | Redis 미기동 | 관찰 | Redis ●빨강 Down, worker 로그에 ECONNREFUSED, 대시보드는 계속 동작 |
| **UAT-005** | API 장애 | dev 서버 종료 | 관찰 | API ●빨강 Down, STATUS=DEGRADED |
| **UAT-006** | Diagnostics 실행 | 기동 상태 | `F9` | 진단 화면, 11항목 ✓/✗ + 실패 원인, 키 입력 시 복귀, audit `USER Diagnostics` |
| **UAT-007** | Command Palette | 기동 상태 | `Ctrl+P` | 팔레트 모달, 타이핑 필터, 명령 선택 실행, Cancel 취소 |
| **UAT-008** | Crash Report | 예외/기동 실패 유발 or 팔레트 `Export Report` | — | `logs/reports/report-*.md` 생성, 서비스상태·리소스·(예외)·최근이벤트 포함 |
| **UAT-009** | 로그 확인 | 운영 후 | 팔레트 `Open Logs` / 파일 탐색 | runtime/error/audit/startup 로그 열람 가능 |
| **UAT-010** | 정상 종료 | 기동 상태 | `ESC` | Shutdown 시퀀스 후 종료, 백그라운드 서비스 정지 |
| **UAT-011** | 테마 변경 | — | `makecc.config.json` theme 변경 후 재기동 | 전 화면 색상 변경 (dark/nord/dracula/catppuccin/gruvbox) |
| **UAT-012** | 재시작/복구 카운트 | 기동 상태 | `F2` 재시작, 서비스 복구 관찰 | Session 패널 Restarts/Recovery 증가 |
| **UAT-013** | 작은 창 방어 | 창 118x34 미만 | 기동/리사이즈 | 크래시 대신 "Terminal too small" 안내, 키우면 자동 진입 |

---

## C. 장애·예외 테스트 (FT)

| ID | 장애 | 예상 동작 | 사용자 안내 | 로그 기록 | Report 생성 |
|----|------|-----------|-------------|-----------|-------------|
| **FT-001** | Docker 종료 | graceful degrade, 컨테이너 패널 "disconnected" | Docker ●빨강, Timeline `Docker Health Failed` | runtime/error | — (치명 아님) |
| **FT-002** | Worker Crash | 프로세스 종료 감지 | Worker=Stopped, Notification | `[worker] process exited` (warn) | — |
| **FT-003** | Redis 연결 실패 | STT/큐 불가, 앱 유지 | Redis=Down, worker ECONNREFUSED 로그 | runtime | — |
| **FT-004** | Database 미설정 | Database=Unknown "Not configured" | 상태 표시 | — | — |
| **FT-005** | Network 장애 | Diagnostics Network=✗, Update 확인 실패(무음) | 진단 화면 원인 표시 | error(업데이트 예외 시) | — |
| **FT-006** | Disk 부족 | 로그/리포트 쓰기 실패 | 앱 계속 동작(로깅 try/catch) | 무음 무시(로깅이 앱 안 죽임) | 실패 시 무음 |
| **FT-007** | 권한 오류 | 프로세스 기동/파일 쓰기 실패 | 해당 서비스 Stopped/에러 로그 | error | — |
| **FT-008** | 설정 파일 오류 | 잘못된 makecc.config.json | 기본값으로 폴백(파싱 실패 무시) | — | — |
| **FT-009** | 치명적 예외 | 최상위 catch | 예외 스택 출력 + 키 대기(창 유지) | error `FATAL` | **✅ report-*.md 생성** |
| **FT-010** | 기동 실패 | Startup Summary=FAILED | Reason 표시 | error | **✅ report 생성** |

### 검증 원칙
- **로깅은 앱을 죽이지 않는다** — 모든 파일 I/O try/catch (FT-006 근거).
- **분석/부가 기능 실패는 무음** — 사용자 흐름 우선.
- **치명 예외·기동 실패만 Report 자동 생성** (FT-009/010).
