# 코드 리뷰 — 2026-07-03 (세션 변경 5097046..HEAD)

> 범위: Tier2 자막어시 + CC 리치 태깅(m1~m5) + 랜딩 변경. 소스 20파일·25커밋.
> 방법: code-analyzer 3병렬(CC워커 / 편집기·Tier2 / 랜딩). high-confidence(≥80%) correctness만.

## 결과 요약
- Critical 2 · Important 5 · (latent 1) → **전부 수정**. minor(장식·비이번세션)는 제외.
- 게이트: tsc·eslint·vitest 225·worker tsc(신규에러0) 통과.

## 수정 내역

### 🔴 Critical
1. **CaptionSuggestion.tsx — TDZ ReferenceError**: dims 폴백 effect가 `read()`를 `const poll=setInterval` **선언 전** 동기 호출 → 영상이 이미 로드된 상태(videoWidth>0, 패널 재마운트·캐시·StrictMode)면 `clearInterval(poll)`이 TDZ로 크래시. → `read()`를 poll/stop 선언 뒤로 이동.
2. **transcribe.ts + sound-events.ts — sound-events 타임아웃 부재**: `runSoundEvents`가 python exit/error로만 resolve → sherpa-onnx가 멈추면 `await soundEventsPromise`가 **영구 블록**(성공할 잡이 finished 못 감), 좀비 python. "STT 무영향" 불변식 붕괴. → `timeoutMs`(오디오길이×0.8s, 최소60s) 추가, 초과 시 `py.kill('SIGKILL')`+`resolve([])`. `settled` 가드로 이중 resolve 방지.

### 🟡 Important
3. **transcribe.ts — 음악만 있는 영상 실패**: `if(cues.length===0) throw`가 사운드 병합 **전**에 실행 → 대사 없고 음악/웃음만 있는 영상이 사운드 감지에도 STT_FAILED. → 병합을 검사 앞으로, `allCues.length===0`일 때만 throw(사운드만으로도 자막 생성).
4. **srt.ts — isSoundCueText greedy 오탐**: `/^\[.+\]$/`가 "[웃으며] 안녕 [계속]" 같은 다중괄호 대사를 sound로 오탐. → 문자클래스로 내부 기호 재등장 배제(`/^\[[^[\]]+\]$/`, `/^♪[^♪]*♪$/`). 테스트 +2.
5. **CueList.tsx — 키보드 내비 숨은 큐 진입**: 토글 OFF 시 ↑↓가 숨겨진 사운드 큐로 이동→선택 사라짐, Enter로 소프트락. → 보이는 큐만 순회하도록 방향 스캔.
6. **EditorShowcase.tsx — reduce-motion 상태 불일치**: `playing` 초기 true인데 reduce는 effect에서 설정 → autoPlay 억제 시 컨트롤이 "재생중"인데 정지. → effect에서 reduce면 `setPlaying(false)`+`pause()`. + `fmt` 분단위 지원(장시간 영상 `0:75` 방지).
7. **download_audio_tagging.py — cwd 상대경로**: `DEST`가 실행 위치 의존 → `__file__` 기준 절대경로. tarfile `filter="data"`(3.12+ 경로 트래버설 방어, 구버전 폴백).

### (latent, 미수정 — 판단)
- **VideoPlayer.tsx crossOrigin=anonymous**: 미래 non-CORS 소스에서 재생 실패 가능. 단 현재/예정 소스 전부 안전(동일오리진 데모·Supabase ACAO:*)하고 **Tier2 캐시오염 방지에 필요**해 유지. 새 소스 도입 시 재검토.

## 참고(미수정 minor)
- CinematicHero `CBARS` 양자화 미적용(하이드레이션 — 이번 세션 변경 아님).
