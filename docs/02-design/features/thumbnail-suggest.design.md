---
template: design
version: 1.0
feature: thumbnail-suggest
date: 2026-07-08
author: shong7500
project: make_cc
status: Draft
architecture: Option C (Pragmatic Balance)
plan: docs/01-plan/features/thumbnail-suggest.plan.md
---

# 섬네일 자동 추출 + 추천 — Design (Option C · 실용 균형)

> Plan(`thumbnail-suggest.plan.md`) 승계. 클라이언트 canvas 온디바이스로 후보 프레임을
> 추출·티어 채점(휴리스틱 필수 + NIMA·BlazeFace lazy 강화)해 베스트 1 + 후보 그리드를
> 추천한다. 다운로드는 순수 클라이언트, 포스터 지정만 얇게 영속(`thumbnails` 버킷).

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 자막에 인접한 부가가치(커버 이미지)를 무료·온디바이스로. 히스토리 포스터로 UI 품질↑. 워커·비용 의존 0(free-tier 정체성). |
| **WHO** | 유튜브·쇼츠·강의 크리에이터 — 자막 후 커버까지 필요. |
| **RISK** | 추천 어색→제안만·오버라이드 / 모델 로드 실패→티어 graceful / 디코드 한계→비표시 / 포스터 영속→얇은 업로드. |
| **SUCCESS** | 베스트 1+후보 근거와 함께 제시, PNG/WebP 다운로드, 포스터 지정→히스토리 반영, 모델 실패에도 휴리스틱으로 성립, 채점 테스트 고정. |
| **SCOPE** | IN: 클라 추출·티어채점·추천 UI·다운로드·포스터 영속. OUT: OG 자동생성·섬네일 에디터·서버 ffmpeg·비전 LLM. |

---

## 1. 아키텍처 개요

**Option C — 클라이언트 티어 채점 + 얇은 영속.** 워커 경로 없음.

```
[편집기 진입·영상 로드]
        │ (비차단, lazy)
        ▼
 features/editor/lib/thumbnail-extract.ts   ← frame-sampler 확장
        │  N개 시점 프레임(다운스케일 canvas/ImageData)
        ▼
 features/editor/lib/thumbnail-score.ts (Tier A · 순수)
        │  선명도·밝기·색감·하단(자막)영역 → per-frame 휴리스틱 점수
        ▼
 features/editor/lib/thumbnail-ai.ts (Tier B · lazy · graceful)
        │  NIMA 미학 + BlazeFace 얼굴 (로드 실패 시 null → Tier A만)
        ▼
 features/editor/lib/thumbnail-suggest.ts (오케스트레이터 · 순수 결합/랭킹)
        │  { best, candidates[], reasons }
        ▼
 features/editor/components/ThumbnailPanel.tsx
        ├─ 다운로드(canvas→toBlob PNG/WebP)  ── 순수 클라(게스트 OK)
        └─ "포스터로 지정"(회원) ─ POST /api/jobs/[id]/thumbnail
                                      → services/jobs.setThumbnail
                                      → lib/storage(thumbnails 버킷·admin)
                                      → jobs.thumbnail_path
                                      → 히스토리 카드·<video poster> 반영
```

- **레이어 경계**: 추출·채점·오케스트레이션은 전부 `features/editor/lib/*` 순수 모듈(클라·테스트 가능). 영속만 얇은 API route → `services/jobs` → `lib/storage`(admin). import 경계 준수(features→types/lib-browser/server actions; 인프라는 services 경유).
- **진보적 강화**: Tier A는 항상 성립. Tier B는 lazy·비차단·실패 강등 = caption-style-assist Tier1/2 검증 패턴 답습.

---

## 2. 열린 질문 확정 (Plan §열린 질문)

### Q1. AI 런타임 → **TF.js (@tensorflow/tfjs + @tensorflow-models/face-detection)**
- **얼굴** = `@tensorflow-models/face-detection`(BlazeFace) 기성 패키지 — 구현량 최소, WebGL/WASM 백엔드.
- **미학** = idealo NIMA(MobileNet·AVA)를 **TF.js GraphModel로 변환**해 얹음.
- onnxruntime-web 통일(B안)은 이연 — 지금은 기성 TF.js 패키지 재사용이 노력 대비 이득.

### Q2. 후보 수 / 샘플 전략 → **균등 16 샘플 → 상위 5 표시, 베스트 1**
- 영상 길이를 균등 분할해 최대 **16 프레임** 추출(양끝 5% 제외: 인트로/아웃트로 회피).
- 다운스케일(예: 긴 변 ≤320px)해 추출·추론 → 성능 확보.
- 인접 **유사 프레임 dedup**(평균 해시 거리) 후 상위 5 표시. 장면전환 감지 모델은 이연.

### Q3. NIMA 가중치 소싱 / 호스팅 → **idealo 변환본 · 자체 호스팅 · lazy**
- 출처: `idealo/image-quality-assessment` aesthetic MobileNet(AVA), Apache-2.0(라이선스 확인 후 반영).
- 호스팅: `public/models/nima/`(정적) — CDN 미의존, HTTP 캐시, 최초 1회 로드(~수 MB).
- 로드/추론 실패 시 aesthetic 항 제거하고 Tier A로 강등.

### Q4. 포스터 영속 스키마 → **`jobs.thumbnail_path` 단일 + `thumbnails` 버킷**
- 선택 시에만 업로드(수십 KB WebP 1장). 다중 후보 저장은 이연.
- private 버킷 + signed URL(videos/subtitles와 동일 패턴).

### Q5. 게스트 정책 → **다운로드=게스트 허용 · 포스터 영속=회원 한정**
- 다운로드는 순수 클라이언트라 신원 무관 허용.
- 포스터 영속은 회원만 — 게스트 잡은 영상 즉시삭제·스토리지 정책 단순화 목적. API가 인증·소유권 검증.

---

## 3. 데이터 모델

### 3.1 마이그레이션 `20260708000001_job_thumbnail.sql`
```sql
alter table public.jobs
  add column if not exists thumbnail_path text;

comment on column public.jobs.thumbnail_path is
  '사용자가 지정한 대표 섬네일 이미지 경로(thumbnails 버킷). null=미지정.';
```

### 3.2 스토리지 버킷
- `thumbnails` (private) — `env.SUPABASE_BUCKET_THUMBNAILS`(기본 'thumbnails'). 마이그레이션에서 `storage.buckets` insert(videos/subtitles/renders와 동일 방식) + RLS.
- 경로 규칙: `thumbnails/{userId}/{jobId}.webp`.

### 3.3 타입
```ts
// features/editor/lib/thumbnail-suggest.ts
export interface ThumbCandidate {
  timeMs: number;
  dataUrl: string;        // 미리보기용(다운스케일)
  score: number;          // 0..1 결합 점수
  signals: {              // 근거 칩용
    sharpness: number; brightness: number; colorfulness: number;
    aesthetic?: number;   // Tier B (NIMA 1..10 정규화)
    face?: number;        // Tier B (얼굴 크기·정면 0..1)
    lowerThirdBusy: number;
  };
}
export interface ThumbSuggestion {
  best: ThumbCandidate | null;
  candidates: ThumbCandidate[];   // best 포함, score desc
  tier: 'A' | 'AB';               // 실제 적용된 티어
}
```

---

## 4. 모듈 상세 (Plan 모듈맵 대응)

### m1 — 후보 추출 `thumbnail-extract.ts`
- `frame-sampler.ts`의 히든 비디오·crossOrigin=anonymous·rVFC·taint/타임아웃 강등 재사용.
- `extractCandidateFrames(videoUrl, { count=16, maxEdge=320, skipEdgePct=0.05 })` → `{ timeMs, canvas/ImageData }[]`.
- 실패(디코드·taint·타임아웃) → 빈 배열(패널 비표시).

### m2 — Tier A 채점 `thumbnail-score.ts` (순수·테스트)
- `frame-analysis.ts` 확장 재사용:
  - **선명도** = Laplacian(또는 Sobel) 분산.
  - **밝기** = 평균 휘도의 적정 구간 근접도(과암/과명 penalty).
  - **색감** = colorfulness(Hasler-Süsstrunk 근사).
  - **하단영역 복잡도** = 자막이 놓일 하단 밴드의 엣지 밀도(낮을수록 가점).
- `scoreTierA(frameSignals) → number(0..1)`, `rankTierA(frames)`.

### m3 — Tier B AI `thumbnail-ai.ts` (lazy·graceful)
- `loadAestheticModel()`(NIMA GraphModel) / `loadFaceDetector()`(BlazeFace) — 동적 import·1회 캐시·실패 시 null.
- `enhanceWithAI(frames)` → per-frame `{ aesthetic?, face? }`. 어느 하나 실패해도 가능한 신호만 채움.
- 결합은 오케스트레이터에서.

### m4 — 오케스트레이터 + UI `thumbnail-suggest.ts` · `ThumbnailPanel.tsx`
- `suggestThumbnails(videoUrl)` = extract → Tier A → (best-effort) Tier B → **정규화 가중 결합** → 랭킹 → `ThumbSuggestion`.
  - 결합(예): `0.35*aesthetic + 0.2*face + 0.2*sharpness + 0.1*brightness + 0.1*colorfulness − 0.15*lowerThirdBusy`. Tier A만이면 aesthetic·face 항 제거 후 재정규화.
- `ThumbnailPanel`: 베스트 크게 + 후보 4~5 그리드, 근거 칩(⭐미학·😀얼굴·✨선명), 다운로드·"포스터로". 비차단 로딩 스켈레톤. 신호부족/실패 시 비표시.

### m5 — 다운로드
- `downloadCandidate(cand, fmt)` = 원본 해상도 재추출(또는 보관) → `canvas.toBlob('image/png'|'image/webp')` → 저장. 서버 불필요·게스트 OK.

### m6 — 포스터 영속
- `POST /api/jobs/[id]/thumbnail`(얇은 controller): 인증·소유권·Zod(body=선택 timeMs 또는 업로드 blob) → `services/jobs.setThumbnail(jobId, blob)` → `lib/storage.uploadThumbnail`(admin, thumbnails 버킷) → `jobs.thumbnail_path` update → `job_events` 기록.
- 히스토리 카드·편집기 `<video poster>` = `thumbnail_path` signed URL.
- 게스트 요청 → 401/403.

### m7 — QA · 정책
- 채점 단위테스트(대표 신호 → 기대 순위·티어 강등), graceful(모델 null), 실브라우저 육안(밝은/어두운/인물 영상), 성능(16프레임 추론 시간), 문서.

---

## 5. 시퀀스

```
편집기 mount → 영상 ready
  → ThumbnailPanel: suggestThumbnails(url)   [비차단]
      → extractCandidateFrames (16, 다운스케일)
      → scoreTierA (동기·빠름)
      → enhanceWithAI (lazy 로드; 성공 시 aesthetic/face 병합)
      → 결합·랭킹 → { best, candidates, tier }
  → 그리드 렌더(베스트 강조 + 근거 칩)
  → [다운로드] toBlob → 저장 (게스트 OK)
  → [포스터로] POST blob → thumbnails 버킷 → jobs.thumbnail_path
      → 히스토리/poster 반영
```

---

## 6. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| 모델 로드 지연/실패 | 티어 구조 — Tier A 항상 성립. Tier B lazy·비차단·실패 강등(`tier:'A'`) |
| 모델 용량(수 MB) | 자체 호스팅·HTTP 캐시·1회 로드·MobileNet 경량 |
| 코덱/디코드 한계(headless) | frame-sampler taint/타임아웃 강등 재사용. 실브라우저 정상, 실패 시 비표시 |
| 추천 어색 | 제안만·후보 그리드·오버라이드. 결합 가중·규칙 문서화+테스트 |
| 게스트 스토리지/영상 즉시삭제 | 포스터 영속은 회원 한정. 다운로드만 게스트 허용 |
| 성능(N프레임 추론) | 다운스케일(≤320)·N 상한(16)·WebGL/WASM 백엔드·dedup |
| CORS taint | VideoPlayer crossOrigin=anonymous + Supabase ACAO:*(검증됨) |

---

## 7. 수용 기준 (Plan 승계 + 구체화)

1. 편집기에서 후보 프레임을 추출해 **베스트 1 + 상위 후보(≤5)** 를 근거 칩과 함께 제시.
2. 추천 섬네일을 **PNG/WebP 다운로드**(순수 클라, 게스트 포함).
3. 회원이 컷을 **포스터로 지정**하면 `jobs.thumbnail_path` 저장 + 히스토리·`<video poster>` 반영.
4. **모델 로드 실패 시** `tier:'A'`로 휴리스틱 추천 성립(에러 없음).
5. 채점·랭킹·티어 강등이 **vitest로 고정**.
6. 신호부족·디코드 실패 시 **비표시**.
7. 게스트 포스터 영속 요청은 **401/403**.

---

## 8. 다음 단계

`/pdca do thumbnail-suggest --scope m1,m2` (워커 없는 MVP=추출+휴리스틱)부터.
권장 순서: **m1·m2 → m4·m5(UI·다운로드) → m3(AI 강화) → m6(포스터 영속) → m7(QA)**.

---

## 9. Session Guide (11.3)

### 9.1 Module Map
| scope key | 모듈 | 산출물 | 선행 |
|-----------|------|--------|------|
| `m1` | 후보 추출 | `thumbnail-extract.ts` | — |
| `m2` | Tier A 채점 | `thumbnail-score.ts` + 테스트 | m1 |
| `m3` | Tier B AI | `thumbnail-ai.ts`(NIMA·BlazeFace 로더) | m2 |
| `m4` | 오케스트레이터+UI | `thumbnail-suggest.ts`·`ThumbnailPanel.tsx` | m2 |
| `m5` | 다운로드 | toBlob 저장 | m4 |
| `m6` | 포스터 영속 | 마이그레이션·버킷·API·`services/jobs`·히스토리/poster | m4 |
| `m7` | QA·정책 | 테스트·graceful·실브라우저·문서 | m3~m6 |

### 9.2 권장 세션 분할
1. **세션 1 (MVP)**: m1 + m2 + m4 + m5 — 워커 없이 동작하는 휴리스틱 추천 + 다운로드. 여기까지로도 가치 성립.
2. **세션 2 (AI 강화)**: m3 — NIMA·BlazeFace 얹기(graceful).
3. **세션 3 (영속·QA)**: m6 + m7 — 포스터 저장·히스토리 반영·검증.
