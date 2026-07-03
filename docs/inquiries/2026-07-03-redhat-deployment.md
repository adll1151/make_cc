# 문의 응답 — Red Hat Linux 운영 환경 적용 (MAKECC Control Center)

| 항목 | 내용 |
|------|------|
| 접수일 | 2026-07-03 |
| 요청자 | 2TS 송우영 대리 |
| 대상 | MAKECC Control Center의 Red Hat Linux 운영 서버 적용 방식 |
| **상태 판정** | **⚠️ 현재 콘솔은 Windows 전용 — Red Hat 직접 실행 불가. 단, 프로덕션 운영엔 콘솔이 필수 아님(서비스 직접 기동 가능).** |

---

## 0. 요약 (TL;DR)

1. **MAKECC Control Center는 현재 Windows 전용**입니다. 타깃 프레임워크가 `net8.0-windows`이고, 프로세스·Docker 제어를 `cmd.exe`로 하드코딩(4개 파일)하며, 실행 스크립트가 `.bat`뿐이라 **Red Hat에서 그대로 실행할 수 없습니다.**
2. **그러나 콘솔은 "로컬 편의 운영/모니터링 TUI"일 뿐, 프로덕션 런타임에 필수가 아닙니다.** Red Hat 운영은 콘솔 없이 서비스(worker·redis·docker)를 **직접(systemd/npm/docker compose) 기동**하면 정상 동작합니다.
3. **⭐ 사전 확인 필요(스코프)**: make_cc **앱 자체는 Vercel**에서 운영됩니다(Red Hat 아님). Red Hat 운영 서버는 **STT GPU 워커 호스트**로 이해되는데, 이 전제가 맞는지 확인 부탁드립니다. (Red Hat에 앱까지 self-host할 계획이면 별도 논의 필요.)

---

## 1. 실행 구조 — 원격 제어 vs 직접 실행

**콘솔은 "직접/로컬" 방식입니다. 원격 제어 도구가 아닙니다.**

- 콘솔(`tools/makecc-console`, .NET 8 Spectre.Console TUI)은 **자신이 실행되는 바로 그 머신의 로컬 프로세스**를 제어합니다: `cmd.exe /c npm run worker`, `docker compose up`, `localhost:3000` 헬스체크 등.
- **SSH/에이전트 기반 원격 제어 기능은 없습니다.** 따라서 "Windows 관리자 PC에서 Red Hat 서버를 원격 제어"하는 구조는 **현재 미지원**입니다.
- 논리적으로는 "Red Hat 서버에서 직접 실행"이 맞는 그림이지만, **현재 빌드가 Windows 전용**이라 Red Hat에서 실행하려면 아래(§2) 포팅이 선행되어야 합니다.

## 2. Red Hat용 실행 파일 / .sh 필요 여부 — **필요 (단순 스크립트가 아니라 포팅)**

현재 Windows 결합 지점과, Red Hat 지원에 필요한 작업:

| 항목 | 현재(Windows) | Red Hat 지원에 필요 |
|------|---------------|--------------------|
| 타깃 프레임워크 | `net8.0-windows` | `net8.0`(플랫폼 무관)로 변경 — **Linux 실행의 전제** |
| 프로세스 제어 | `ProcessManager`가 `cmd.exe /c npm run …` | `/bin/sh -c` (또는 OS 분기) |
| Docker/진단 | `DockerService`·`Diagnostics`·`Infrastructure`가 `Cli.Wrap("cmd.exe")` | `/bin/sh` 로 교체 (OS 분기) |
| 실행 스크립트 | `start.bat` | `start.sh` (+ `dotnet publish -r linux-x64`) |
| GPU DLL 등록 | whisper.py의 Windows CUDA DLL 등록은 `sys.platform=='win32'` 가드됨 | Linux는 그대로 OK(가드 통과) |

→ **`.sh` 하나 추가로 끝나는 게 아니라, `cmd.exe` → 셸 추상화 + 타깃 변경이 필요한 소규모 포팅 작업**입니다. 예상 규모는 협의 필요(대략 1~2일 + 검수).

## 3. Docker / Worker / API 기동·제어가 Red Hat에서 동일 동작?

**하위 서비스 = 동일하게 동작. 콘솔의 "제어 계층" = 현재 미동작.**

- **서비스 자체(크로스플랫폼)**: `npm run worker`(Node), `docker compose`, Redis, Next.js(dev/build), Whisper(faster-whisper, CUDA) — 전부 Linux에서 정상 동작합니다. STT GPU도 `WHISPER_DEVICE=auto`로 CUDA 자동 감지.
- **콘솔의 제어(Windows 결합)**: 위 서비스를 **콘솔이 기동·감시하는 부분**이 `cmd.exe` 기반이라 Red Hat에선 그대로는 동작하지 않습니다.
- **결론**: Red Hat에서는 **콘솔 없이 서비스를 직접 기동**(예: worker를 systemd 서비스로 등록, `docker compose up -d`)하면 운영에 문제 없습니다. 콘솔 포팅은 "관리 편의" 목적의 별건입니다.

## 4. 최종 운영 환경 기준 배포 절차 / 운영 가이드

- **현재 Red Hat 전용 배포 런북은 없습니다.** 기존 문서(`worker/README.md`, `CLAUDE.md`)는 개발/로컬 기준입니다.
- **제공 예정(권장)**: Red Hat 운영 런북 신규 작성 — ① Node/CUDA/ffmpeg/pyannote 설치 ② `.env`(Supabase·DeepL·HF 토큰·Whisper 모델) ③ AudioTagging 모델 다운로드(`npm run worker:models`) ④ worker를 **systemd 서비스**로 등록(자동 재시작) ⑤ Redis(BullMQ) 또는 `worker:poll`(DB 폴링) 선택 ⑥ 로그/모니터링.
- 단, §0-3 스코프(“Red Hat = 워커 호스트”, 앱은 Vercel) 확정 후 작성하겠습니다.

---

## 회신 요지 (요청자 앞)

1. **구조**: 콘솔은 로컬 직접 실행형(원격 제어 X). Red Hat 관리하려면 Red Hat에서 직접 실행해야 하나 현재 Windows 전용이라 불가 → 포팅 필요.
2. **.sh/실행파일**: 필요. `net8.0` 타깃 변경 + `cmd.exe`→셸 교체 + `start.sh` 포팅 작업(협의).
3. **서비스 동작**: worker·docker·API·GPU STT는 Red Hat에서 정상. 콘솔의 제어 계층만 미동작 → **Red Hat에선 콘솔 없이 서비스 직접 기동(systemd 권장)**.
4. **가이드**: Red Hat 운영 런북 신규 제공 예정. 단 **“Red Hat 서버의 역할(워커 전용? 앱까지?)” + “앱은 Vercel 유지 여부”** 먼저 확인 요청.

**핵심 권고**: 운영 초기엔 **콘솔 포팅을 필수 경로에서 분리**하고, Red Hat에선 **worker를 systemd 서비스로 직접 운영**하는 것을 권장합니다(콘솔은 Windows 관리 PC의 편의 도구로 유지). 콘솔 Linux 포팅은 우선순위·일정 협의 후 별도 진행.
