# Discord 서버 운영 셋업 — Option C (Pragmatic Balance)

> make_cc Discord 통합의 운영 가이드.
> 서버 구조 설계 근거: `docs/01-plan/features/discord-integration.plan.md §7.5`,
> `docs/02-design/features/discord-integration.design.md §7.5`.
>
> **대상 서버**: https://discord.gg/D6hrNbYK9

---

## 1. 적용할 구조 (Option C)

미니멀(2채널, 문의가 잡담에 묻힘)과 풀 커뮤니티(10+채널·레벨링 봇, 1인 운영 부담·죽은 채널) 사이의
**공지·커뮤니티·지원 3축만 명확히 분리**한 구조. 봇 알림은 개인 DM이 주 경로라 채널을 더럽히지 않는다.

### 카테고리 / 채널 (8~9개)

| 카테고리 | 채널 | 유형 | 설명 |
|----------|------|------|------|
| 📌 시작하기 | `환영-규칙` | 읽기 전용 | make_cc 소개 + 규칙 + 계정 연결 안내 |
| 📣 공지 | `공지사항` | 읽기 전용 | 운영자 공지 (@everyone) |
| 📣 공지 | `업데이트` | 읽기 전용 | 릴리스·기능 변경 changelog |
| 💬 커뮤니티 | `일반` | 쓰기 | 자유 잡담 |
| 💬 커뮤니티 | `자막-자랑` | 쓰기 | 결과물 공유 (showcase) |
| 💬 커뮤니티 | `피드백-제안` | 쓰기 | 기능 요청·아이디어 |
| 🛟 지원 | `문의` | 쓰기 | Q&A·사용법 |
| 🛟 지원 | `버그-신고` | 쓰기 | 버그 리포트 |
| 🤖 비공개 | `봇-로그` | 비공개 | 운영자 전용. 봇 DM 발송 실패·rate limit 경고만 |

### 역할 (3개 + 봇)

| 역할 | 색 | 부여 | 권한 |
|------|-----|------|------|
| `운영자` | 보라 | shong7500 | **라벨로 생성됨(권한 0).** 관리자 권한은 소유자가 수동 부여 |
| `회원` | 초록 | 계정 연결 사용자 (Phase 2 자동, Phase 1 수동) | 커뮤니티·지원 채널 쓰기 |
| `손님` | 회색 | 서버 입장 기본 | 읽기 + `일반` 쓰기 |
| `make-cc-bot` | — | (봇 초대 시 자동) | `봇-로그` 쓰기 + 개인 DM 발송만 |

> ⚠️ 봇은 자기가 갖지 않은 권한을 가진 역할을 만들 수 없다(Discord 50013). 그래서 셋업 스크립트는
> `운영자`를 **권한 없는 라벨**로 생성한다. 서버 소유자는 이미 전체 권한이 있으므로, 공동 운영자가
> 필요할 때만 서버 설정 → 역할 → `운영자`에 관리자 권한을 켜고 그 사람에게 부여하면 된다.

### 채널 권한 의도

- **읽기 전용** 채널: `@everyone`의 `SEND_MESSAGES` 거부 (운영자만 게시).
- **비공개** `봇-로그`: `@everyone`의 `VIEW_CHANNEL` 거부 + `운영자` 역할·봇에만 보기/쓰기 허용.
- 나머지 커뮤니티/지원 채널: 기본 권한(모두 읽기·쓰기).

---

## 2. 적용 방법 A — 자동 스크립트 (권장)

`scripts/discord-setup.mjs`가 위 구조를 Discord REST API로 생성한다.
**create-only**(이름이 같은 채널/역할이 이미 있으면 건너뜀) — 기존 채널을 삭제하지 않으므로 안전하다.

### 사전 준비 (1회)

1. **봇 생성**: https://discord.com/developers/applications → New Application → Bot 탭 → Reset Token
   → 토큰을 `.env`의 `DISCORD_BOT_TOKEN`에 입력.
2. **봇 초대** (서버에 추가 + 권한 부여): 아래 URL의 `CLIENT_ID`를 본인 앱 ID로 바꿔 브라우저에서 열기.
   `Manage Channels` + `Manage Roles` 권한(`268435472`)이 필요하다.
   ```
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot&permissions=268435472
   ```
3. **(선택) Guild ID**: `.env`에 `DISCORD_GUILD_ID`를 넣으면 그걸 사용. 없으면 스크립트가 초대 코드
   `D6hrNbYK9`로 자동 해석한다.

### 실행

```powershell
# 1) 계획만 출력 (아무것도 바꾸지 않음 — 검토용)
node --env-file=.env scripts/discord-setup.mjs

# 2) 검토 후 실제 적용
node --env-file=.env scripts/discord-setup.mjs --apply
```

> 기본 실행은 **dry-run**: 무엇이 생성/스킵될지 출력만 한다. `--apply`를 붙여야 실제로 만든다.
> 적용 후 결과를 보고, 기존에 있던 불필요한 채널은 **직접** 정리하면 된다(스크립트는 삭제하지 않음).

---

## 3. 적용 방법 B — 수동 (스크립트 없이)

서버 설정에서 직접:

1. **역할 생성** (서버 설정 → 역할): `운영자`(관리자 권한 ON), `회원`, `손님`. 색상은 위 표 참고.
2. **카테고리 생성**: 📌 시작하기 / 📣 공지 / 💬 커뮤니티 / 🛟 지원 / 🤖 비공개.
3. **채널 생성**: 위 표대로 각 카테고리에 배치.
4. **읽기 전용 설정** (`환영-규칙`, `공지사항`, `업데이트`): 채널 편집 → 권한 → `@everyone` → "메시지 보내기" ✗.
5. **비공개 설정** (`봇-로그`): 채널 편집 → 권한 → `@everyone` "채널 보기" ✗, `운영자`·봇 "채널 보기/보내기" ✓.

---

## 4. 앱 연동 환경변수

`.env` (참조: `.env.example`):

```
DISCORD_BOT_TOKEN=...                  # 봇 DM 발송 + 셋업 스크립트
DISCORD_OAUTH_REDIRECT_URL=...         # {APP_URL}/auth/discord/callback (module-3)
NEXT_PUBLIC_DISCORD_INVITE_URL=https://discord.gg/D6hrNbYK9   # 헤더/마이페이지 초대 링크
DISCORD_GUILD_ID=...                   # (선택) 셋업 스크립트 대상 서버
```

또한 Supabase Dashboard → Authentication → Providers → **Discord 활성화 + Manual Linking ON**
(module-3 Account Linking에 필요).

---

## 5. 주의

- 봇 토큰은 **서버/워커 전용** — 절대 클라이언트(브라우저)에 노출 금지.
- 봇이 사용자에게 DM을 보내려면 사용자가 **이 서버에 참여**해 있어야 한다(`NEXT_PUBLIC_DISCORD_INVITE_URL`로 유도).
- 사용자가 "서버 멤버의 DM 허용"을 끄면 50007로 차단 → 앱이 이메일 fallback + 마이페이지 배지 처리.
