# MAKECC Control Center — 실사용 영상 녹화 런북

목적: 인수 검토용 **5~10분 실사용 화면 녹화**. 아래 순서를 그대로 따라 하면 요청 시나리오가 모두 담깁니다.
편집 없이 흐름 그대로 진행하면 됩니다.

## 사전 준비 (1회)
1. **.NET 8 SDK** 설치 확인 — `dotnet --version` ≥ 8
2. **터미널**: Windows Terminal을 **최대화**(최소 118 x 34). 폰트는 한글·유니코드 지원(예: Cascadia Code, D2Coding).
3. **녹화 도구**: `Win + G`(Xbox Game Bar) → 녹화, 또는 OBS. 대상 = 터미널 창.
4. (선택, 더 "정상 기동"처럼 보이려면) Redis 준비 — Docker나 Upstash `REDIS_URL`. 없으면 Redis/Docker는 "Disconnected"로 표시됨(정상 동작, degrade). 이 상태로도 녹화 OK.
5. 첫 실행 빌드 미리: `dotnet build -c Release tools\makecc-console` (녹화 중 컴파일 대기 방지)

> 팁: 녹화 시작 후 각 화면에서 **2~3초 머무르며** 육안 확인이 되게 천천히.

---

## 녹화 시나리오 (순서대로, ~8분)

### 1. 실행 + Splash + 정상 기동  `[start.bat]`
- 터미널에서 **`start.bat`** 실행(또는 `dotnet run -c Release --project tools\makecc-console`).
- **Splash**(MAKECC 로고) → **Boot 시퀀스**(⠋ Loading Environment → Checking Docker → Starting Containers → Starting Worker → Starting API → Health Check → Ready) 스피너가 도는 걸 보여줌.
- **Startup Summary**(Environment/Docker/API/Worker/Redis/Database OK·FAIL + Elapsed + Result) 잠시 노출.
- → **Dashboard** 진입. *(약 60초)*

### 2. Dashboard 확인  `[F1]`
- 상단 로고 + STATUS/VERSION/NODE/DOCKER/UPDATE, **Notification Center**(우상단).
- 좌: Services · 중: System(CPU/RAM Sparkline) · 우: **Event Timeline**.
- 하단: Session 바 · Live Log · Footer 단축키.
- 마우스/눈으로 각 패널을 천천히 훑기. *(약 40초)*

### 3. Event Timeline / Notification 확인
- **Event Timeline** 패널에 부팅 이벤트(`Docker Connected`/`API Listening`/`Worker Running` 등) 시간순 표시.
- 헤더 우상단 **NOTIFICATIONS**에 최근 알림 확인. *(약 20초)*

### 4. History 뷰  `[F6]` → `[F1]`
- **F6** → History 뷰: Containers · Latest Deployment · Recent Launches · Failed Launches.
- 실행 이력(`logs/history.json` 기반)이 Recent에 쌓인 것 확인 → **F1**로 복귀. *(약 20초)*

### 5. Command Palette 실행  `[Ctrl+Shift+P]`
- **Ctrl+Shift+P** → 팔레트 모달. 타이핑으로 필터(예: `restart` 입력) → 목록 좁혀지는 것 보여줌.
- 일단 **Cancel**(첫 항목) 또는 Esc로 닫기. *(약 25초)*

### 6. Diagnostics 실행  `[F9]`
- **F9** → 전체 진단: Docker·Worker·API·Redis·Database + Docker Compose·Network·Git·Node·PowerShell·.NET Runtime 11항목 ✓/✗ + 실패 원인.
- 결과 표 잠시 노출 → 아무 키나 눌러 복귀. *(약 30초)*

### 7. Worker/API 재시작  `[F2]`
- **F2** → "Worker + API Restarted". Live Log에 재시작 로그, Timeline/Notification에 이벤트, **Session의 Restarts 카운트 증가** 확인. *(약 25초)*

### 8. 장애 → 복구 재현  `[Ctrl+Shift+P → Stop Worker]` → `[F2]`
- **Ctrl+Shift+P** → `Stop Worker` 선택 실행.
- Dashboard에서 **Worker ● 빨강 Stopped**, Timeline `Worker Health Failed`, Notification 표시 확인. *(2~3초 대기)*
- **F2**(재시작) → Worker 다시 Running, Timeline `Worker Recovered`, **Session의 Recovery 카운트 증가** 확인. *(약 40초)*
- (Redis는 미기동이면 항상 Down으로 표시 — 자연 장애 상태도 함께 보여줄 수 있음)

### 9. Report 생성  `[Ctrl+Shift+P → Export Report]` → `[Open Reports Folder]`
- **Ctrl+Shift+P** → `Export Report` → `logs/reports/report-*.md` 생성(Live Log에 "Report 생성" 표시).
- **Ctrl+Shift+P** → `Open Reports Folder` → 탐색기에서 방금 생성된 `.md` 열어 내용(서비스 상태·리소스·최근 이벤트) 잠깐 보여줌. *(약 40초)*
- (참고: 실제 치명 예외 시엔 자동으로 Crash Report가 생성됨 — 여기선 수동 Export로 동일 형식 확인)

### 10. 로그 확인  `[Ctrl+Shift+P → Open Logs Folder]`
- **Ctrl+Shift+P** → `Open Logs Folder` → `logs/{startup,runtime,error,audit,reports,archive}` 구조 + 파일 열어 확인.
- 특히 `audit/`에 방금까지의 사용자 작업(Restart/Stop/Export/Diagnostics)이 기록된 것 보여줌. *(약 30초)*

### 11. 정상 종료  `[ESC]`
- **ESC** → Shutdown 애니메이션(Stopping Worker → API → Redis → Docker) → "Thank you for using MAKECC" → 종료. *(약 20초)*

---

## 커버리지 체크 (요청 시나리오 ↔ 단계)
| 요청 항목 | 단계 |
|-----------|------|
| 프로그램 실행(Splash) | 1 |
| 정상 기동 | 1 |
| Dashboard | 2 |
| Event Timeline / Notification | 3 |
| Command Palette | 5 |
| Diagnostics | 6 |
| 로그 / History | 4, 10 |
| Worker/API 재시작 | 7 |
| 장애 → 복구 / Health 실패 | 8 |
| Crash Report / Report 생성 | 9 |
| 정상 종료 | 11 |

## 참고
- 총 ~8분. 각 단계에서 조금 더 머무르면 10분에 맞출 수 있음.
- Docker 미설치 환경이면 Docker/Redis/Containers는 "Disconnected/Down"으로 정상 표시(장애 대응 UX도 함께 보임 → 오히려 검토에 유용).
- 별도 편집 없이 이 순서대로 진행하면 됩니다.
