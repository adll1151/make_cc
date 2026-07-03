# 변경 이력 (Changelog)

make_cc의 버전별 작업 기록입니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/),
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

라이브: **[makecc.vercel.app](https://makecc.vercel.app)** · 저장소: **[github.com/adll1151/make_cc](https://github.com/adll1151/make_cc)**

<!-- 각 릴리스 날짜는 헤딩 아래 HTML 주석(<!-- date: YYYY-MM-DD --​>)으로만 기록하고 화면에는 표시하지 않습니다. -->

---

## [0.7.0] · 리치 CC(오디오 이벤트 태깅) + Whisper Turbo
<!-- date: 2026-07-03 -->

make_**cc**의 이름값 — 대사만이 아니라 **소리까지 자막에.** 비음성 오디오 이벤트를 감지해 표준 CC 표기로 삽입한다. 실영상 headed E2E로 검증.

### Added
- **리치 CC — 오디오 이벤트 태깅** — sherpa-onnx **AudioTagging**(AudioSet 527클래스, CPU)로 음악·박수·웃음·기침 등 비음성 소리를 감지해 `♪ 음악 ♪`·`[웃음]` 등 표준 CC 큐로 자막에 삽입. Whisper(GPU)와 **CPU 병렬**이라 처리 지연 ≈0. 편집기에서 앰버 톤·🔊 배지로 대사와 구분하고 표시 토글 제공. 청각장애인 접근성.
- **Whisper large-v3-turbo** — 809M 모델로 전환(large-v3 대비 **VRAM ~40%↓ · 속도 ~2배↑ · 전사 동일**). 같은 GPU에 CC 여유 확보.
- **자막 스타일 어시 Tier 2.1** — 배경이 애매하게 복잡할 때(박스 미적용 구간) 외곽선 자동 강화.

### Fixed
- **CC 파이프라인 안정화** — sound-events 서브프로세스 타임아웃·kill(행 방지), 음악만 있는 영상도 자막 생성, SRT 재파싱 시 `kind` 복원(`♪…♪`/`[…]` 휴리스틱), 편집기 사운드 큐 키보드 내비.
- **자막 어시 dims/CORS/프레임 대기** — canvas 프레임 샘플링 실동작 3대 버그(headed E2E 발견) + 코드리뷰 지적(TDZ 등) 수정.

---

## [0.6.1] · 자막 어시 Tier 2 실동작 수정
<!-- date: 2026-07-03 -->

v0.6.0의 자막 스타일 어시 Tier 2(프레임 인지형 보정)가 실제 브라우저에서 완전히 미작동했던 문제를 수정. 단위 테스트는 통과했으나 통합 경로에 3대 버그가 있었고, 흰 배경 실영상 **headed E2E**(업로드→GPU STT→편집기)로 근본원인을 잡아 `◆ 배경이 밝아요 → 박스` 보정이 정상 렌더됨을 확인.

### Fixed
- **dims 읽기 레이스** — 편집기 로딩 중 `videoUrl`이 null이라 `<video>`가 아직 DOM에 없어 `querySelector`가 null→조기 탈출(effect deps `[]`). video 요소 자체를 폴링하도록 수정해 늦게 나타나도 종횡비를 얻음. (dims 없으면 프레임 샘플링이 게이트에 막혀 Tier 2가 아예 미작동.)
- **CORS 캐시 오염** — 메인 `<video>`(crossOrigin 없음)가 signed URL을 먼저 캐시 → 샘플러의 `crossOrigin=anonymous` 요청이 그 캐시를 재사용해 canvas taint. VideoPlayer에 `crossOrigin="anonymous"` 추가(Supabase signed URL은 ACAO:*라 재생 무영향).
- **프레임 대기 무한 정지** — 오프스크린 히든 비디오는 컴포지터에 프레임을 표시하지 않아 `requestVideoFrameCallback`이 영영 발화하지 않음 → 샘플러가 완료를 못 함. `waitForFrame`에 250ms 타임아웃 폴백 추가.

---

## [0.6.0] · 자막 스타일 어시 + 퍼널 분석
<!-- date: 2026-07-03 -->

무료 티어 폴리싱·사용자 확보 방향. 편집기가 영상·자막을 분석해 어울리는 번인 자막 스타일을 추천하고, 퍼스트파티 퍼널 분석으로 유입→전환을 자체 계측한다. 전부 $0(외부 SaaS·유료 API 없음).

### Added
- **자막 스타일 어시 Tier 1(휴리스틱)** — 영상 종횡비·CPS·화자 수 등 보유 데이터만으로 프리셋을 추천(`✨ 추천 적용`). 순수 클라이언트.
- **자막 스타일 어시 Tier 2(프레임 인지형)** — 브라우저 canvas로 영상 프레임을 샘플링해 자막 영역의 밝기·대비·주색·피사체 쏠림을 분석 → 색/박스/위치를 자동 보정(밝은 배경→박스, 하단 인물→자막 위로). Tier 1에 progressive enhancement로 얹음. Supabase signed URL이 CORS(ACAO:*)를 제공해 실잡에서도 동작.
- **퍼스트파티 퍼널 분석** — page_view→업로드→잡 완료→편집기→SRT 다운로드를 Supabase에 직접 적재(외부 SaaS 0·$0). `npm run funnel` 리포트 CLI.
- **운영자 대시보드** — `/admin/analytics`(ADMIN_EMAILS allowlist 게이팅, robots disallow).
- **가입 전 샘플 편집기** — `/editor/sample`로 로그인 없이 편집기 체험.
- **MAKECC 콘솔 revamp** — .NET8 운영 콘솔 신규 버전(Watchdog·DiscordNotifier 등), 테스트 45개.

### Fixed
- **자막 어시 dims 레이스** — 번인 패널 지연 마운트로 video `loadedmetadata`를 놓쳐 Tier 2가 미작동하던 문제를 videoWidth 폴링 폴백으로 해결(headed E2E로 발견).
- **middleware** — 손상된 auth 쿠키로 전체 500 나던 문제 방지.

---

## [0.5.0] · 자막 다국어 번역 (phase3)
<!-- date: 2026-06-24 -->

완성된 한국어 자막을 다른 언어로 번역하는 기능. 백엔드부터 편집기 번역 패널·번인 다국어까지 구현·검증 완료. main 머지(PR#2) + 프로덕션 배포 완료(Check 96%).

### Added
- **자막 번역 백엔드** — DeepL API(무료 티어)로 한국어 SRT를 대상 언어로 번역. cue 텍스트만 교체하고 타임스탬프·인덱스는 원본 보존.
- **번역 도메인** — `translations` 테이블(렌더 도메인 미러: pending→translating→done/failed) + 잡 큐(poll-loop) 비동기 처리 + SSE 진행률.
- **게이팅** — 무료 영상당 1개 언어 / Pro 무제한.
- **언어 설정(확장형)** — 초기 영어·일본어·중국어. 설정 배열에 추가만으로 확장.
- **API** — `POST /api/translations`, `GET /api/translations/[id]`(+`/stream`), `GET /api/jobs/[id]/translations`.
- **편집기 번역 패널** — 언어 추가·SSE 진행률·언어별 SRT 다운로드(메인 편집과 분리된 read-only 트랙).
- **번인 다국어** — `renders.subtitle_lang`으로 번역본을 영상에 번인(원본 ko는 카라오케, 그 외 평문).
- **번역 가독성 후처리** — 줄바꿈(≤42자·2줄 균형) + CPS≤17 타이밍 보정(Netflix/BBC 기준).

### Changed
- **편집 UX 개편** — 구간 재생(▶ 끝 자동정지) · 타임코드 편집(±0.1s, 이웃 clamp) · 자막 추가/삭제 · CPS 배지 · 키보드 내비게이션.

---

## [0.4.0] · 흑백 미니멀 전면 재디자인 + 모션 (phase2)
<!-- date: 2026-06-24 -->

데스크톱 happy-path 위주였던 Phase 1을 "믿고 쓰는 제품"으로 끌어올린 릴리스. 비주얼 전면 개편 + 모바일 대응 + 콘텐츠 보강.

### Added
- **데모 페이지 `/demo`** — 브라우저에서 자막 생성·편집을 체험하는 인터랙티브 데모.
- **블로그 `/blog`** — SRT 가이드·Whisper 소개·유튜브 자막 넣기 등 콘텐츠(SEO).
- **React Bits / 모션 컴포넌트** — 스크롤 reveal, 그라데이션 텍스트, 통계 카운트업, 꾸민 배경 등.

### Changed
- **흑백 미니멀 전면 재디자인** — 랜딩·편집기 등 전반 비주얼 개편 + 라이트/다크 개편.
- **모바일 에디터** — 좁은 화면에서 영상/자막/스타일 탭 전환으로 편집 가능.

### Fixed
- 번인 렌더 진행률 % + SSE 실시간 반영. CountUp 무한 재시작 버그 수정.
- 랜딩 광고 제거 + 광고 킬스위치(AdSense "콘텐츠 없는 화면" 재심사 대응).

---

## [0.3.0] · 프로덕션 준비 + 실서비스 처리 검증
<!-- date: 2026-06-20 -->

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

## [0.2.0] · 수익화 + 법적 고지
<!-- date: 2026-06-17 -->

### Added
- **Google AdSense** 연동 (`ads.txt`, 광고 슬롯 컴포넌트).
- **개인정보처리방침 `/privacy`** — 수집·이용·보관·파기 + 쿠키/광고 고지.

### Changed
- 광고 공급자 **Adcash → Google AdSense** 전환.

---

## [0.1.0] · 초기 릴리스
<!-- date: 2026-06-17 -->

한국어 영상 자막 자동 생성 + 번인 자막 스튜디오 풀스택 베이스.

### Added
- **자막 자동 생성 파이프라인** — 업로드 → self-hosted Whisper(large-v3, ko) STT → 표준 SRT. 잡 상태 머신 + append-only 이벤트.
- **브라우저 자막 편집기** — `<video>` 동기화 + cue 단위 편집 + 자동 저장.
- **번인 자막 스튜디오** — 프리셋 5종 + 폰트·색·외곽선·위치·박스·카라오케 커스텀 → 스타일 박힌 MP4(원본/9:16/1:1). ffmpeg + libass(ASS) 기반.
- **무료/Pro 게이팅** — 무료 워터마크+720p / Pro 워터마크 제거+1080p. `services/render` 단일 지점에서 강제.
- **공유 · 게스트 지원 · 알림(Resend/Discord) · 자동 청소**.
- **인프라** — Next.js 15(App Router) + Supabase(Auth/Postgres/Storage, RLS) + BullMQ/Redis 큐 + 별도 GPU 워커. Redis 미연결 시 DB 폴링 워커로 graceful degrade.

### 초기 커밋 이전 작업
<!-- date: 2026-06-16 -->
- **libass PoC** — WSL Ubuntu에서 한국어 번인+카라오케 렌더 검증. ASS Events `Format:`의 `Text` 필드 누락 버그 발견·수정.
- **워커 렌더(module-3)** — ffmpeg probe/번인, render 서비스, poll-loop.

---

[0.5.0]: https://github.com/adll1151/make_cc/releases/tag/v0.5.0
[0.4.0]: https://github.com/adll1151/make_cc/releases/tag/v0.4.0
[0.3.0]: https://github.com/adll1151/make_cc/releases/tag/v0.3.0
[0.2.0]: https://github.com/adll1151/make_cc/releases/tag/v0.2.0
[0.1.0]: https://github.com/adll1151/make_cc/releases/tag/v0.1.0
