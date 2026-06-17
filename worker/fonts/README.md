# worker/fonts — 번인 자막 폰트 (OFL)

ffmpeg `ass` 필터(`fontsdir=worker/fonts`)가 여기서 폰트를 로드합니다.
**라이선스: SIL Open Font License(OFL) 등 상업 이용 가능 폰트만** 둘 것.

## 필요 파일

| CaptionFont (`types/caption-style.ts`) | 파일 | 폰트 내부 family명 (반드시 일치) |
|---|---|---|
| `Pretendard` | `Pretendard-Regular.ttf` (+ `-Bold`) | `Pretendard` |
| `NotoSansKR` | `NotoSansKR-Regular.ttf` (+ `-Bold`) | `Noto Sans KR` ⚠️ |

> **중요**: `buildAss`가 출력하는 `fontFamily`(`Pretendard`/`NotoSansKR`)와 폰트의
> **내부 family명**이 일치해야 fontconfig가 매칭합니다(불일치 시 tofu □□□).
> Noto Sans KR의 내부 family명은 보통 `Noto Sans KR`(공백 포함)이므로,
> `NotoSansKR` 식별자를 쓰려면 ① 파일 family명을 맞추거나 ② fontconfig alias를 추가하거나
> ③ `buildAss` 호출 측에서 family명을 정규화해야 함. (module-4/6에서 매핑 확정)

## 출처

- Pretendard: https://github.com/orioncactus/pretendard (OFL-1.1)
- Noto Sans KR: https://fonts.google.com/noto/specimen/Noto+Sans+KR (OFL-1.1)

## 검증 (PoC 완료)

Linux ffmpeg + fontconfig + Noto CJK로 한국어 번인·카라오케 렌더 성공.
자세한 내용은 메모리 `project-libass-poc` 참조. ASS Events `Format:`은 반드시
`...Effect, Text`로 끝나야 함(없으면 빈 자막 렌더).
