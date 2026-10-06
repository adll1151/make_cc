# _unused — 삭제 후보 보관함

현재 코드에서 쓰이지 않는 파일을 원래 경로 구조 그대로 옮겨 둔 곳입니다(2026-10-06).
검토 후 필요 없으면 폴더째 지우고, 다시 쓸 파일은 원래 위치로 되돌리면 됩니다.

- 빌드·타입 검사·린트·테스트 대상이 아니고(`tsconfig`는 `src/`만 포함), Vercel 배포에서도 제외됩니다(`.vercelignore`).
- `local/`은 git에 올라가지 않는 로컬 잔여물입니다(`.gitignore`).

## src/components — 어디서도 import되지 않는 UI 컴포넌트 (18개)

판정: knip 미사용 파일 탐지 + 경로·파일명 grep 교차 확인(참조 0). 대부분 랜딩 재디자인 전 시안에서 쓰던 효과 컴포넌트입니다.

| 파일 | 비고 |
|---|---|
| `components/CountUp.tsx` | 현재는 `components/reactbits/CountUp.tsx`를 사용 |
| `components/EditorDemo.tsx` | 아래 `EditorPeekCard`에서만 쓰였음 |
| `components/LiveCaptionDemo.tsx` | 구 랜딩 데모 |
| `components/motion/CaptionStory.tsx` | 구 랜딩 스토리 섹션 |
| `components/motion/EditorPeekCard.tsx` | 구 랜딩 카드 |
| `components/motion/Parallax.tsx` | |
| `components/motion/SpotlightArticle.tsx` | |
| `components/reactbits/ClickSpark.tsx` | |
| `components/reactbits/GradientText.tsx` | |
| `components/ui/animated-shiny-text.tsx` | magicui 계열 |
| `components/ui/border-beam.tsx` | magicui 계열 |
| `components/ui/dot-pattern.tsx` | magicui 계열 |
| `components/ui/marquee.tsx` | 현재 마퀴는 `reactbits/ScrollVelocity` 사용 |
| `components/ui/number-ticker.tsx` | magicui 계열 |
| `components/ui/particles.tsx` | magicui 계열 |
| `components/ui/shimmer-button.tsx` | 아래 `shimmer-link-button`에서만 쓰였음 |
| `components/ui/shimmer-link-button.tsx` | |
| `components/ui/spotlight.tsx` | |

## scripts/poc — libass 한국어 번인 PoC 산출물 (46개, 약 15MB)

번인(ffmpeg+libass) 한국어·카라오케 렌더 검증용 실험 스크립트와 결과 이미지·영상·ASS 샘플입니다. 검증은 끝났고 본 기능은 `worker/`에 구현돼 있습니다.
`worker/fonts/README.md`가 폰트 QA 재현 방법으로 `gen-font-qa.mts`를 가리킵니다.

⚠️ `fonts/arial.ttf`·`fonts/malgun.ttf`는 Windows 기본 글꼴로, 공개 저장소에 재배포하면 라이선스 문제가 될 수 있습니다. 지울 때 git 이력에서도 제거할지 함께 판단하세요.

## local/ — git 미추적 로컬 잔여물 (약 34MB)

| 파일 | 내용 |
|---|---|
| `server.zip` | 2026-07-03 워커 배포 묶음(574개 파일) — 현재 소스로 다시 만들 수 있음 |
| `devserver.log` | 2026-06-24 dev 서버 로그 |
| `e2e-ingest.log`, `e2e-ingest2.log` | 2026-06-23 E2E 로그 |
| `test.mp4` | 2026-06-14 초기 테스트 영상 |

## 옮기지 않은 것 (사용 중으로 판단)

- `scripts/*.mjs` — Discord·Notion·Jira·분석 운영 스크립트(직접 실행용 도구)
- `tools/makecc-console`, `start.bat` — MAKECC 콘솔
- `test-tmp/` — 수동 E2E 테스트 영상·음성
- `logs/`, `makecc.config.json` — 콘솔 실행 중 사용
- `src/app/test` — 랜딩 리디자인 시안(작업 중)
- `trashcan/` — 기존 로컬 스크래치 보관함(git 미추적)
