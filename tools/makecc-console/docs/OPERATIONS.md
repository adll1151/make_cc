# MAKECC Control Center — 운영 매뉴얼

운영자용 실전 참조 문서. (개요는 상위 `README.md`)

## 1. 설치

```bat
:: .NET 8 SDK (1회)
winget install Microsoft.DotNet.SDK.8
dotnet --version   :: 8.x 확인
```
- Windows 전용(`net8.0-windows`). 저장소 클론/배치 후 루트에 `start.bat` 위치.
- 선택: Docker Desktop(Redis 컨테이너용). 없으면 Redis 항목은 degrade.

## 2. 실행

```bat
start.bat
```
또는
```bat
dotnet run -c Release --project tools\makecc-console\MakeccConsole.csproj
```
- 반드시 **저장소 루트 하위**에서 실행 (런처가 `package.json`을 위로 탐색해 루트·.env·워커 경로를 찾음).
- 최초 실행 시 `makecc.config.json` 자동 생성.
- 콘솔 **118 x 34 이상**(최대화 권장). 미만이면 안내 화면.

## 3. 종료

- 대시보드에서 **`ESC`** → Shutdown 시퀀스(Worker→API→Redis→Docker) 후 종료.
- 백그라운드 dev/worker 프로세스도 정지됨. PID는 `logs/.pids.json`.
- 강제 종료 후 잔여 프로세스: `taskkill /IM node.exe /T /F` (주의: 다른 node도 종료됨).

## 4. 단축키

| 키 | 동작 |
|----|------|
| `F1` / `F6` | Main / History 뷰 |
| `F2` | Worker + API 재시작 |
| `F9` | Diagnostics 화면 |
| `Ctrl+Shift+P` | Command Palette |
| `F4` | 브라우저 열기(localhost:3000) |
| `ESC` | 종료 |

## 5. 설정 파일 — `makecc.config.json` (저장소 루트)

```json
{
  "theme": "dark",
  "logs": { "archiveAfterDays": 7, "retentionDays": 30 },
  "update": { "enabled": true, "repo": "adll1151/make_cc" }
}
```
| 키 | 의미 |
|----|------|
| `theme` | `dark`·`nord`·`dracula`·`catppuccin`·`gruvbox` |
| `logs.archiveAfterDays` | N일 지난 runtime/error 로그 → `archive/` gzip 이동 |
| `logs.retentionDays` | N일 지난 archive 삭제 |
| `update.enabled` / `update.repo` | 업데이트 확인 on/off · 비교 대상 GitHub 저장소 |

변경 후 **재기동** 시 반영. 파일이 깨지면 기본값으로 자동 폴백.

## 6. 로그 위치

```
logs/
  startup/  기동 1회분 (startup-YYYY-MM-DD_HHmmss.log)
  runtime/  전체 로그 (runtime-YYYY-MM-DD.log)
  error/    ERROR만 (error-YYYY-MM-DD.log)
  audit/    사용자 작업 (audit-YYYY-MM-DD.log)  ← 재시작·종료·진단 등
  reports/  크래시/실패 보고서 (report-*.md)
  archive/  오래된 로그 gzip 보관
```
- 빠른 접근: Command Palette → **Open Logs Folder** / **Open Reports Folder**.
- 실시간 추적: `Get-Content logs\runtime\runtime-<날짜>.log -Wait -Tail 40`

## 7. Report 위치 & 활용

- 경로: `logs/reports/report-YYYY-MM-DD-HHmmss.md`
- 생성 시점: **치명 예외**·**기동 실패** 자동, 또는 Palette **Export Report** 수동.
- 포함: 시각·버전·git 커밋·OS·서비스 상태·CPU/메모리·(예외 스택)·최근 이벤트.
- 활용: 그대로 이슈/메신저에 첨부(운영자 간 장애 공유).

## 8. Diagnostics 사용법

- 대시보드에서 **`F9`** (또는 Palette → Diagnostics).
- 헤드리스: `makecc --diagnostics`
- 점검 항목: Docker·Worker·API·Redis·Database(서비스) + Docker Compose·Network·Git·Node·PowerShell·.NET Runtime(환경).
- 실패 항목은 원인(예: "포트 3000 미응답") 함께 표시.

## 9. Update 확인

- 헤더 **UPDATE** 행에 최신 여부 표시 (기동 시 자동, 비차단).
- 수동: Palette → **Check for Updates**, 또는 `makecc --check-updates`.
- 업데이트 있으면 Notification에 `Update Available: vX.Y.Z`. **확인만**, 자동 설치 없음.

## 10. 트러블슈팅

| 증상 | 원인 / 조치 |
|------|-------------|
| 실행 즉시 창 닫힘 | 콘솔 크기 부족 → 최대화. 그래도면 `logs/error/` 확인 |
| "Terminal too small" | 창을 118x34 이상으로 |
| Docker Disconnected | Docker Desktop 미실행 → 실행하거나 무시(Redis는 외부 URL 대체 가능) |
| Worker Stopped 반복 | Redis 미연결(ECONNREFUSED). Redis 기동 또는 `.env` REDIS_URL 확인 |
| 경로 못 찾음 | 저장소 루트 밖에서 실행. `start.bat`을 루트에 두고 실행 |
| 한글 깨짐 | `start.bat`이 `chcp 65001` 설정. 콘솔 폰트가 한글 지원하는지 확인 |

## 11. 자동 검증 (CI/인수)

```bat
dotnet test tools\makecc-console.Tests   :: 단위 31 케이스
makecc --selftest                        :: 렌더 스모크
makecc --diagnostics                     :: 점검
```
자세한 테스트/검수 기준: `docs/TEST-PLAN.md`, `docs/ACCEPTANCE-CHECKLIST.md`, `docs/TRACEABILITY.md`.
