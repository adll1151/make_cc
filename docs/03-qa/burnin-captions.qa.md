# burnin-captions — QA & 검증 (module-6)

> Design: `docs/02-design/features/burnin-captions.design.md` §7, §8

## 1. is_pro 게이팅 강제 (서버·워커)

게이팅은 **단일 지점(`services/render/createRender`)** 에서 강제되고, 워커는 게이팅된 값을 그대로 렌더한다 → 클라이언트가 값을 위조해도 누수 없음.

| 단계 | 위치 | 강제 내용 |
|------|------|-----------|
| 1. 요청 검증 | `app/api/renders` (zod) | shape만 검증 (resolution은 신뢰 안 함) |
| 2. 게이팅 | `services/render/gating.resolveRenderGating` | 무료→`watermark=true`+`720`, Pro→`watermark=false`+`≤1080` |
| 3. 저장 | `createRender` insert | renders 행에 **게이팅된** watermark/resolution 기록 |
| 4. 렌더 | `worker/render.ts processRender` | `render.watermark`·`render.resolution`(=게이팅 값)으로 ffmpeg 번인 |

**자동 검증 (Vitest)**
- `tests/unit/services/render/gating.spec.ts` (6) — 무료 1080 요청→720+워터마크, Pro→요청대로, 1080 초과 클램프
- `tests/unit/services/render/create-render.spec.ts` (7) — insert 페이로드가 게이팅 반영 + 소유검증(FORBIDDEN)/finished(INVALID_INPUT)/enqueue

## 2. 출력 자동삭제

| 대상 | 보존 | 위치 |
|------|------|------|
| 렌더 MP4 (게스트) | finished + 24h | `worker/render.ts computeOutputDeleteAt` |
| 렌더 MP4 (회원) | finished + 7일 | 〃 |
| 청소 실행 | poll-loop 30초마다 | `services/render/cleanupExpiredRenders` → renders 버킷 삭제 + `output_storage_key=null` |

**자동 검증**: `tests/unit/services/render/cleanup-renders.spec.ts` (4) — 만료 2건 삭제+null화, 대상 없음, 부분실패 errors, scan 실패.

## 3. 한국어 영상 수동 QA (체크리스트)

> **전제**: `worker/fonts/`에 OFL 폰트 `.ttf` 배치 (Pretendard / NotoSansKR). family명이 `CaptionStyle.fontFamily`와 정확히 일치해야 함(fontconfig). 카라오케 검증은 `{jobId}.words.json`(whisperX 단어 타이밍) 필요 — 없으면 평문 fallback(카라오케 자동 OFF).

- [ ] 한국어 영상 업로드 → 자막 생성(finished)
- [ ] 편집기에서 프리셋 5종 미리보기 — 한글 깨짐(tofu) 0
- [ ] **무료**: 720p + 워터마크 출력 확인 (1080 선택해도 720으로 강등)
- [ ] **Pro**(`user_profiles.is_pro=true` 수동 토글): 1080p + 워터마크 없음
- [ ] 비율 원본 / 9:16 / 1:1 각각 번인 결과 정상 (crop 중앙)
- [ ] 카라오케 ON + words.json 있는 영상 → 단어별 하이라이트
- [ ] 5분 영상 렌더 ≤ 2분 (SUCCESS 기준)
- [ ] 출력 24h(게스트)/7일(회원) 후 다운로드 URL 만료 + cleanup 삭제

## 4. 미해결 전제 (블로킹)
- `worker/fonts/*.ttf` 바이너리 배치 (사용자 작업)
- whisperX 단어 타이밍 미통합 시 카라오케 비활성 (평문 렌더는 정상)
