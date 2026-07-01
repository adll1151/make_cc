# MAKECC Control Center — 최종 검수 체크리스트

인수 시 이 목록만으로 검수 가능. 각 항목 확인 후 체크. (참조 TC = TEST-PLAN.md)

## 사전 조건
- [ ] .NET 8 SDK 설치됨 (`dotnet --version` ≥ 8) — UAT-001
- [ ] 저장소 루트에서 실행 (`package.json` 존재) — 경로 탐색 전제
- [ ] `.env` 준비 (Supabase 등) — UAT-001
- [ ] 콘솔 창 ≥ 118 x 34 (또는 최대화) — UAT-013

## 기동 / 화면
- [ ] **Splash 화면** — Figlet 로고 + 부트 스피너 회전 — IT-001
- [ ] **Startup Summary** — 단계별 OK/FAIL + Result(SUCCESS/FAILED) — IT-001, UAT-001
- [ ] **Dashboard 표시** — 헤더/Services/System/Timeline/Session/Live Log 정렬, 무깜빡 갱신 — IT-005
- [ ] **Timeline 동작** — 서비스 상태 이벤트가 시간순 표시 — IT-006, UAT-003
- [ ] **Notification 표시** — 헤더 우상단 최근 알림(색상 구분) — IT-006
- [ ] **Session 정보** — Started/Duration/Restarts/Recovery/Status — UAT-012
- [ ] **Sparkline** — CPU/RAM 추이 그래프 — IT-005
- [ ] **Update Check** — 헤더 UPDATE 행 or `--check-updates` — IT-011
- [ ] **멀티뷰** — F6 History ↔ F1 Main 전환 — IT-008

## 기능
- [ ] **Diagnostics 실행** (F9) — 11항목 ✓/✗ + 실패 원인 — UAT-006, IT-010
- [ ] **Command Palette 실행** (Ctrl+Shift+P) — 필터·실행·취소 — UAT-007
- [ ] **History 저장** — `logs/history.json`에 실행 이력 누적 — IT-001
- [ ] **Report 생성** — 예외/실패 or Export Report → `logs/reports/report-*.md` — UAT-008, FT-009/010
- [ ] **Audit Log** — 재시작·종료 등 `logs/audit/`에 기록 — IT-009
- [ ] **Theme 변경** — config theme 변경 → 색상 반영(5종) — UAT-011
- [ ] **정상 종료** (ESC) — Shutdown 애니메이션 후 서비스 정지 — UAT-010

## 장애 대응 (graceful degrade)
- [ ] **Docker 미실행** — 크래시 없이 진행, Disconnected 표시 — UAT-002, FT-001
- [ ] **Worker/Redis/API 장애** — 해당 상태 빨강 + 이벤트, 앱 유지 — UAT-003/004/005
- [ ] **작은 창** — 크래시 대신 안내 — UAT-013
- [ ] **설정 파일 오류** — 기본값 폴백 — FT-008
- [ ] **치명 예외** — 스택 출력 + 창 유지 + Report 생성 — FT-009

## 로그 구조
- [ ] `logs/` 하위 **startup·runtime·error·audit·reports·archive** 생성 — IT-007, FT-006
- [ ] 오래된 로그 archive 이동/압축(보관기간 설정) — R12

## 자동 검증 (CI 가능)
- [ ] `dotnet test` — **단위 31 케이스 통과** (UT-001~023)
- [ ] `makecc --selftest` — 대시보드 렌더 예외 없음
- [ ] `makecc --diagnostics` — 점검 결과 출력
- [ ] `makecc --check-updates` — 버전 비교 출력

---
**검수 판정**: 위 필수 항목 전부 체크 + `dotnet test` 통과 시 인수 완료.
