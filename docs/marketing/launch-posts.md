# 런칭 소개글 초안 (Track B — 유통)

> 대상: 첫 실사용자 확보. 톤 = 정직·기술적·과장 없음(긱뉴스/개발자 커뮤니티 성향).
> ⚠️ **런칭 전 체크**: STT 워커(내 PC)가 켜져 있어야 실제 자막이 나옵니다. 런칭 시간대엔 워커 상시 가동.
> URL: https://makecc.vercel.app · 저장소: https://github.com/adll1151/make_cc

---

## 1) 긱뉴스 (news.hada.io) — "Show GN" 스타일

**제목**
> make_cc — 한국어 영상 올리면 자막 자동 생성, 대사뿐 아니라 소리(♪음악♪·[웃음])까지 · 편집·번역·번인 (무료, self-hosted Whisper)

**본문**
안녕하세요. 한국어 영상 자막을 자동으로 만들어주는 웹서비스 **make_cc**를 만들었습니다.

영상을 올리면 self-hosted **Whisper large-v3-turbo**로 한국어 음성을 인식해 **SRT 자막**을 만들고, 브라우저에서 바로 미리보기·편집·다운로드까지 됩니다. 최근엔 대사만이 아니라 **소리 이벤트(음악·박수·웃음 등)까지 자막에 넣는 "리치 CC"** 를 붙였습니다.

**뭐가 되나요**
- 업로드 → 자동 자막 (타임코드까지) · 화자 분리
- **진짜 CC — 대사뿐 아니라 소리도**: 비음성 오디오 이벤트를 감지해 `♪음악♪`·`[웃음]`·`[박수]` 등으로 자막에 (Whisper 전사 ∥ 오디오 태깅 병렬 처리, 무료·기본 ON)
- **AI 섬네일 추천** — 영상에서 얼굴·선명도·구도 좋은 컷을 골라 커버 이미지로 추천 (브라우저 온디바이스, PNG/WebP 다운로드 + 포스터 지정)
- 브라우저 편집기 (영상 위 실시간 미리보기 + 라인 단위 수정)
- 표준 **SRT 다운로드** (유튜브·프리미어·다빈치에 바로)
- **다국어 번역** — 한 번 만들면 영·일·중 자동 번역 (사운드 큐도 대상 언어 표기로)
- **번인 MP4** — 쇼츠/릴스용으로 자막 박힌 영상 출력
- **무료** · 카드 등록 없이 게스트로도 · **처리 후 원본 자동 삭제**(게스트 1시간/회원 30일)

**왜 만들었나**
기존 툴은 유료거나 자막이 어색하거나 데이터를 어디에 쓰는지 불투명한 게 많았습니다. 그래서 ①self-host Whisper로 품질 확보 ②학습에 안 쓰고 처리 후 삭제 ③무료 게스트로 부담 없이 — 세 가지를 원칙으로 잡았습니다. 그리고 "CC(폐쇄형 자막)"라면 대사만이 아니라 소리도 담아야 한다고 봐서 리치 CC까지 넣었습니다.

**기술 스택** (관심 있는 분들)
Next.js 15(App Router) · Supabase(Auth/DB/Storage) · BullMQ/Redis 잡큐 · GPU 워커(faster-whisper large-v3-turbo + pyannote 화자분리) · **sherpa-onnx AudioTagging(CPU, 리치 CC 사운드 이벤트)** · **TF.js BlazeFace(섬네일 얼굴 감지)** · DeepL(번역) · ffmpeg/libass(번인).

피드백 환영합니다. 특히 인식 정확도·편집 UX·번인 스타일 쪽 의견 주시면 반영하겠습니다. 🙏
👉 https://makecc.vercel.app

---

## 2) Product Hunt (EN)

**Tagline**
> Korean video → real closed captions (dialogue + sounds), editable, translated, burned-in. Free.

**Description**
make_cc auto-generates Korean subtitles from your video using self-hosted Whisper (large-v3-turbo). Unlike dialogue-only tools, it also tags non-speech sounds (music, laughter, applause) as ♪music♪ / [laughter] — real closed captions. Preview, edit, translate (EN/JA/ZH), pick an AI-suggested thumbnail, and export — all in the browser.

- 🎙️ Auto SRT with timecodes + speaker diarization
- 🔊 Rich CC — tags non-speech audio events (music/applause/laughter), not just dialogue
- 🖼️ AI thumbnail suggestion (on-device face + composition scoring)
- ✏️ In-browser editor with live preview over the video
- 🌏 One-click translation to English/Japanese/Chinese
- 🔥 Burn-in MP4 for Shorts/Reels
- 🆓 Free, no card, guest-friendly — originals auto-deleted after processing

Built for creators, lecturers, and anyone who needs Korean captions fast. No training on your data.
👉 https://makecc.vercel.app

---

## 3) 커뮤니티 짧은 톤 (아카라이브 유튜버 채널 / 클리앙 / 디시 편집 갤)

> 한국어 영상 자막 자동으로 만들어주는 거 만들었습니다 (무료)

영상 올리면 AI가 한국어 음성 인식해서 **SRT 자막** 자동 생성해줍니다.
- **대사뿐 아니라 소리(음악·웃음·박수)도** ♪음악♪·[웃음]으로 자막에 (리치 CC)
- 영상에서 **커버 섬네일도 AI가 추천** (얼굴·구도 좋은 컷)
- 브라우저에서 바로 편집 (영상 보면서 라인 수정)
- 영·일·중 번역도 한 방에
- 쇼츠용으로 자막 박은 MP4도 출력
- **무료 + 가입 없이도 + 처리 후 자동삭제**

유튜브 롱폼/강의/쇼츠 자막 다는 데 써보시고 이상한 점 있으면 댓글로 알려주세요. 계속 고치는 중입니다.
makecc.vercel.app

---

## 배포 순서 (권장)
1. **워커 켜기** (내 PC `npm run worker:poll`) — 런칭 중 실제 처리 보장
2. 데모 GIF/스크린샷 첨부 (아래 capture 스크립트)
3. 긱뉴스 먼저 → 반응 보고 커뮤니티 확산 → Product Hunt(영문, 별도 타이밍)
4. **`npm run funnel`** / `/admin/analytics` 로 유입·전환 관찰 → 이탈 구간 개선
