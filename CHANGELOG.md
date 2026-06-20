# 변경 이력 (Changelog)

make_cc의 날짜별·버전별 작업 기록입니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/),
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

라이브: **[makecc.vercel.app](https://makecc.vercel.app)** · 저장소: **[github.com/adll1151/make_cc](https://github.com/adll1151/make_cc)**

---

## [0.3.0] — 2026-06-20 · 프로덕션 준비 + 실서비스 처리 검증

배포 환경에서 실제로 자막이 생성되도록 만든 릴리스. 폰트·정책·콘텐츠를 채우고,
업로드가 큐에서 멈추던 버그를 잡고, 로컬 폴링 워커로 end-to-end 처리를 검증했다.

### Added
- **한국어 번인 폰트 번들** — Pretendard(Regular/Bold) + Noto Sans KR(Regular/Bold) OFL `.ttf` 배치(+라이선스). Noto는 가변폰트를 `wght 400/700` 정적 인스턴싱.
- **사용법 가이드 `/guide`** — 업로드→자동 자막→편집→번인 스튜디오→다운로드·공유 5단계 + 품질 팁.
- **자주 묻는 질문 `/faq`** — 요금·포맷·정확도·보안·편집·번인·공유 등 11문답.
- **`robots.ts` / `sitemap.ts`** — 콘텐츠 페이지만 색인, 유틸·샌드박스 화면은 제외.
- **번인 카라오케** — whisper `word_timestamps`로 단어 단위 타이밍을 추출·저장(`{jobId}.words.json`)해 단어 하이라이트 활성화.

### Fixed
- **폰트 family 매핑 버그** — `NotoSansKR` 식별자를 fontconfig 내부 family명 `Noto Sans KR`로 정규화(`assFontName`). 미수정 시 자막이 tofu(□□□)로 렌더되던 문제.
- **AdSense 정책 위반** — 광고가 준비중 샌드박스(`/test`)·업로드 처리 화면에 노출되던 것을 제거. `/test` 프로덕션 404, 광고는 콘텐츠 페이지로만 한정.
- **자막 줄바꿈** — 긴 한 줄이 프레임 폭을 넘어 잘리던 문제. ASS `WrapStyle 0`(자동 줄바꿈) + 좌우 마진 폭 비례.
- **업로드가 "큐 대기"로 안 넘어가던 버그** — `lib/redis`가 import 시 raw IORedis·BullMQ QueueEvents를 eager 연결(error 리스너 없는 dead 코드)해, Redis 미연결 프로덕션에서 unhandled 'error'가 진행상태 SSE 함수를 죽이던 문제. dead export 제거 + Queue에 error 핸들러.
- 워커 BullMQ 연결 에러 로그를 큐당 1회로 dedupe.

### Verified
- Vercel 프로덕션 배포 + 로컬 DB 폴링 워커(`worker:poll`)로 **실제 한국어 자막 생성 end-to-end 검증**(GPU/CUDA, 카라오케 포함).

---

## [0.2.0] — 2026-06-17 · 수익화 + 법적 고지

### Added
- **Google AdSense** 연동 (`ads.txt`, 광고 슬롯 컴포넌트).
- **개인정보처리방침 `/privacy`** — 수집·이용·보관·파기 + 쿠키/광고 고지.

### Changed
- 광고 공급자 **Adcash → Google AdSense** 전환.

---

## [0.1.0] — 2026-06-17 · 초기 릴리스

한국어 영상 자막 자동 생성 + 번인 자막 스튜디오 풀스택 베이스.

### Added
- **자막 자동 생성 파이프라인** — 업로드 → self-hosted Whisper(large-v3, ko) STT → 표준 SRT. 잡 상태 머신 + append-only 이벤트.
- **브라우저 자막 편집기** — `<video>` 동기화 + cue 단위 편집 + 자동 저장.
- **번인 자막 스튜디오** — 프리셋 5종 + 폰트·색·외곽선·위치·박스·카라오케 커스텀 → 스타일 박힌 MP4(원본/9:16/1:1). ffmpeg + libass(ASS) 기반.
- **무료/Pro 게이팅** — 무료 워터마크+720p / Pro 워터마크 제거+1080p. `services/render` 단일 지점에서 강제.
- **공유 · 게스트 지원 · 알림(Resend/Discord) · 자동 청소**.
- **인프라** — Next.js 15(App Router) + Supabase(Auth/Postgres/Storage, RLS) + BullMQ/Redis 큐 + 별도 GPU 워커. Redis 미연결 시 DB 폴링 워커로 graceful degrade.

### 초기 커밋 이전 작업 (2026-06-16)
- **libass PoC** — WSL Ubuntu에서 한국어 번인+카라오케 렌더 검증. ASS Events `Format:`의 `Text` 필드 누락 버그 발견·수정.
- **워커 렌더(module-3)** — ffmpeg probe/번인, render 서비스, poll-loop.

---

[0.3.0]: https://github.com/adll1151/make_cc/releases/tag/v0.3.0
[0.2.0]: https://github.com/adll1151/make_cc/releases/tag/v0.2.0
[0.1.0]: https://github.com/adll1151/make_cc/releases/tag/v0.1.0
