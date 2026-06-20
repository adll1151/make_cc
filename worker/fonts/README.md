# worker/fonts — 번인 자막 폰트 (OFL)

ffmpeg `ass` 필터(`fontsdir=worker/fonts`)가 여기서 폰트를 로드합니다.
**라이선스: SIL Open Font License(OFL) 등 상업 이용 가능 폰트만** 둘 것.

## 필요 파일

| CaptionFont (`types/caption-style.ts`) | 파일 | 폰트 내부 family명 (반드시 일치) |
|---|---|---|
| `Pretendard` | `Pretendard-Regular.ttf` (+ `-Bold`) | `Pretendard` |
| `NotoSansKR` | `NotoSansKR-Regular.ttf` (+ `-Bold`) | `Noto Sans KR` ⚠️ |

> **매핑 확정(2026-06-20)**: `lib/ass.ts`의 `assFontName()`가 식별자 →
> fontconfig 내부 family명을 매핑한다(`NotoSansKR` → `Noto Sans KR`, `Pretendard` → `Pretendard`).
> 번들된 `.ttf`의 내부 family명도 이에 맞춰 둠:
> - `Pretendard-{Regular,Bold}.ttf` → family `Pretendard` (npm pretendard@1.3.9 alternative static)
> - `NotoSansKR-{Regular,Bold}.ttf` → family `Noto Sans KR` (google/fonts 가변폰트를
>   `wght=400/700`으로 인스턴싱 + name 테이블 정규화. 가변폰트 기본 인스턴스가
>   Thin이라 정적화하지 않으면 자막이 너무 얇게 렌더됨)
>
> WSL Ubuntu ffmpeg `ass:fontsdir=worker/fonts`로 두 폰트 모두 한국어 번인 렌더
> tofu 없이 검증 완료(2026-06-20). 재현: `scripts/poc/gen-font-qa.mts`.

## 출처

- Pretendard: https://github.com/orioncactus/pretendard (OFL-1.1)
- Noto Sans KR: https://fonts.google.com/noto/specimen/Noto+Sans+KR (OFL-1.1)

## 검증 (PoC 완료)

Linux ffmpeg + fontconfig + Noto CJK로 한국어 번인·카라오케 렌더 성공.
자세한 내용은 메모리 `project-libass-poc` 참조. ASS Events `Format:`은 반드시
`...Effect, Text`로 끝나야 함(없으면 빈 자막 렌더).
