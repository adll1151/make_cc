# 리치 CC(오디오 이벤트 태깅) — QA 체크리스트

> feature: cc-rich-tagging · Plan/Design: `docs/01-plan|02-design/features/cc-rich-tagging.*`
> 상태(2026-07-03): m1~m5 구현 완료. component/integration 검증 완료, 풀 E2E(실영상+이벤트)만 잔여.

## 정책 (m5)
- **CC는 기본 ON·무료** — 정체성(Closed Caption)이라 프리미엄 게이트 아님. 워커가 항상 감지·생성.
- **사용자 제어**: ①편집기 per-cue 삭제(원치 않는 사운드 큐 개별 제거) ②사운드 자막 **표시 토글**(뷰 전용, 저장·다운로드 불변).
- **베스트에포트**: 모델 부재·감지 실패 시 CC 사운드만 빠지고 STT/잡은 정상.

## 검증 완료 ✅
| 항목 | 방법 | 결과 |
|------|------|------|
| m1 Turbo | RTX 실측(한국어 12s) | 1.54×·VRAM 44%↓·전사 동일 |
| m2 API | sherpa-onnx 필드 확인 | event/emotion + AudioTagging 노출 |
| m2 라이브 | test_wavs 실측 | Music 0.79·Laughter 0.93, 한국어 말→Speech(오탐 없음) |
| m2 순수함수 | vitest 13개 | 매핑·임계·병합 통과 |
| m2 통합 | runSoundEvents+eventsToSoundCues 실wav | 음악→♪음악♪1큐, 웃음→[웃음]/[울음], 대사→0 |
| m3 파이프라인 | mergeCuesByTime+buildSrt | 대사+CC 인터리브 SRT |
| m4 편집기 | 샘플편집기 스크린샷 | 앰버 카드+🔊 사운드 배지 구분 |
| m5 토글 | 편집기 | 사운드 큐 표시/숨김(뷰 전용) |

## 잔여 — 풀 E2E (수동)
- [ ] 음악/웃음 **포함 실영상** 업로드 → 워커(large-v3-turbo + `npm run worker:models`) → 편집기에서 `♪음악♪`/`[웃음]` 큐가 시점 맞게 표시 + SRT 다운로드에 포함.
- [ ] 무음/일반 대화 영상 → 사운드 큐 0(오탐 없음) 확인.
- [ ] 사운드 큐 개별 삭제 → 저장 → 다운로드에서 제외 확인.
- [ ] 토글 OFF → 리스트에서 숨김, 저장 후 다운로드엔 여전히 포함(비파괴 확인).

## 회귀 가드
- `kind` 미사용 기존 잡: speech-only 동일 동작(하위호환) — tsc·vitest 통과.
- worker `runSoundEvents` 베스트에포트: 모델 없어도 STT 정상.
