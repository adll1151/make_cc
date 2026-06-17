---
template: design
version: 1.3
feature: burnin-captions
date: 2026-06-16
author: shong7500
project: make_cc
status: Draft
---

# burnin-captions Design Document

> **Summary**: Option C — 렌더를 독립 엔티티(`renders` 테이블 + `services/render` + `lib/ass` pure)로 분리하되 **기존 BullMQ 큐·워커 프로세스를 재사용**(`kind:'render'` 분기). 단어 타이밍(whisperX) → ASS 스타일 자막(카라오케) → ffmpeg `ass` 필터 번인 → MP4(원본/9:16, 무료 워터마크/720p · Pro 제거/1080p).
>
> **Project**: make_cc
> **Version**: 0.1.0
> **Author**: shong7500
> **Date**: 2026-06-16
> **Status**: Draft
> **Planning Doc**: [burnin-captions.plan.md](../../01-plan/features/burnin-captions.plan.md)
> **Parent**: video-auto-caption (SRT) · speaker-diarization (whisperX 단어 타이밍 공유)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema | ✅ (§3) |
| Phase 2 | Convention | ✅ (§10) |
| Phase 3 | Mockup | N/A (Tailwind v4 + shadcn) |
| Phase 4 | API Spec | ✅ (§4) |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | SRT 변환은 공짜 commodity → 구독 가치 부재. 번인 스타일 자막 = willingness-to-pay #1. 글로벌 툴의 한국어 빈틈 공략 |
| **WHO** | 한국어 숏폼 크리에이터(유튜버·릴스·틱톡), 강의·홍보 영상 제작자 |
| **RISK** | ffmpeg 번인 렌더 부하(시간·GPU) / 한글 폰트 라이선스·tofu / 출력 스토리지 비용 / whisperX 단어 타이밍 정확도 |
| **SUCCESS** | 번인 MP4 생성률 ≥ 95%, 세로 9:16, 한글 깨짐 0, 무료/Pro 게이팅, 5분 영상 렌더 ≤ 2분 |
| **SCOPE** | Phase1: 단어타이밍 + ASS + ffmpeg 번인 + 프리셋 + 게이팅 / Phase2: 번역·이모지·애니메이션 / Phase3(out): B-roll·AI훅·4K·배치 |

---

## 1. Overview

### 1.1 Design Goals

- **기존 SRT 흐름 무변경**: 번인은 **추가 산출물**. transcribe/SRT/편집기/공유는 그대로.
- **렌더 독립 + 인프라 단순**: 렌더는 별도 엔티티(`renders`)·서비스·pure ASS 빌더로 분리하되, **큐·워커는 기존 것 재사용**(배포 프로세스 1개 유지).
- **게이팅은 서버·워커 강제**: 워터마크·해상도는 클라이언트 신뢰 안 함. 워커가 `is_pro`·render 설정을 읽어 강제.
- **한글 품질 1순위**: OFL 폰트 번들 + fontconfig 등록으로 tofu 0.
- **Pure 렌더 로직**: ASS 생성은 input→output 결정적 pure 함수 → 테스트 용이.

### 1.2 Design Principles

- **단어 타이밍 소비자**: 본 feature는 whisperX 단어 타임스탬프를 *소비*. 없으면 줄 단위 fallback(카라오케 비활성).
- **단일 진실**: 자막 텍스트는 SRT/cues, 스타일은 `renders.style`, 출력은 `renders.output_storage_key`.
- **append-only 상태**: 렌더 상태 전이는 `renders.status` + 실패 사유 기록.
- **얇은 컨트롤러**: API/액션은 검증·게이팅·큐 인입만, 실제 렌더는 워커.

---

## 2. Architecture (Option C — Pragmatic Balance, 선정)

### 2.0 Comparison (요약)

| Criteria | A Minimal | B Clean | **C Pragmatic ⭐** |
|----------|:-:|:-:|:-:|
| 렌더 추적 | jobs 확장 | renders + 독립 상태머신 | **renders 테이블(가벼움)** |
| 큐/워커 | 기존 재사용/transcribe 끼움 | 별도 큐 + 워커 프로세스 | **기존 큐 + kind 분기, 동일 워커** |
| ASS | 인라인 | lib 분리 | **lib/ass pure** |
| New files | ~6 | ~18 | **~11** |
| 배포 부담 | 낮음 | ❌ 워커 2개 | **낮음** |

**Rationale**: STT·렌더 생명주기를 섞지 않으면서(별도 renders) 인프라는 단순 유지(단일 워커·단일 큐). 렌더 부하가 커지면 큐만 분리해 B로 진화.

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────┐
│  Browser — Editor (features/editor)           │
│   CaptionStylePanel · TemplatePicker          │
│   미리보기(ASS→canvas 근사 or video overlay)   │
│   ExportButton(aspect·resolution)             │
│   RenderProgress (polling)                     │
└───────────────┬───────────────────────────────┘
                │ server action / POST /api/renders
                ▼
┌──────────────────────────────────────────────┐
│  Next.js App                                  │
│   services/render: createRender / getRender   │
│     - 게이팅(is_pro): 무료=워터마크+720p 강제   │
│     - renders 행 생성(pending) + 큐 인입        │
└───────────────┬───────────────────────────────┘
                │ enqueue { kind:'render', renderId }
                ▼
┌──────────────────────────────────────────────┐
│  BullMQ (기존 큐 재사용)                        │
└───────────────┬───────────────────────────────┘
                ▼
┌──────────────────────────────────────────────┐
│  Worker (기존 프로세스 + 분기)                  │
│   poll → kind === 'transcribe' → transcribe.ts │
│        → kind === 'render'     → render.ts     │
│   render.ts:                                   │
│    1 video 다운로드 + words.json 로드           │
│    2 lib/ass.buildAss(cues, style) → subs.ass  │
│    3 ffmpeg -vf ass(+crop 9:16 +watermark)     │
│    4 renders 버킷 업로드 + status=done          │
└──────────────────────────────────────────────┘
        │                         │
        ▼                         ▼
  Supabase Storage          Supabase Postgres
  videos / subtitles        jobs / renders / user_profiles(is_pro)
  / renders(출력 MP4)
```

### 2.2 Data Flow

```
[STT 시점(whisperX)] cue + word timings → subtitles 버킷에 {jobId}.words.json 저장
        ↓
[편집기] words.json + SRT 로드 → CaptionStyle 선택/미리보기
        ↓ "번인 내보내기" (aspect, resolution)
[createRender] 게이팅 적용(무료→watermark=true, res=720) → renders(pending) + enqueue
        ↓
[worker render.ts] video + words.json → buildAss → ffmpeg 번인 → renders 버킷
        ↓
[renders.status=done, output_storage_key] → 편집기 폴링 → signed URL 다운로드
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `lib/ass.ts` | (pure) | cue+style → ASS |
| `worker/render.ts` | lib/ass, worker/lib/ffmpeg, services/storage, services/render | 번인 렌더 |
| `worker/lib/ffmpeg.ts` (확장) | ffmpeg+libass | `-vf ass` + crop + drawtext |
| `services/render` | lib/supabase/admin, services/storage, services/auth(is_pro) | 렌더 잡 생성·상태·게이팅 |
| `app/api/renders/*` | services/render | 생성/상태 |
| `features/editor/*` | services/render(action), types/caption-style | 스타일·내보내기·진행률 |
| STT 파이프라인 | whisperX | words.json 산출 |

---

## 3. Data Model

### 3.1 Types

```typescript
// types/subtitle.ts (확장)
export interface WordTiming { text: string; startMs: number; endMs: number; }
export interface Cue { /* 기존 */ words?: WordTiming[]; }  // whisperX 단어 타이밍(옵션)

// types/caption-style.ts (NEW)
export type CaptionPosition = 'bottom' | 'middle' | 'top';
export type CaptionAspect = 'original' | '9:16' | '1:1';

export interface CaptionStyle {
  template: string;            // 프리셋 키 (e.g. 'basic')
  fontFamily: string;          // 번들 폰트 ('Pretendard' | 'NotoSansKR')
  fontSizePct: number;         // 영상 높이 대비 % (반응형)
  color: string;              // #RRGGBB (주 색)
  outlineColor: string;        // 외곽선
  outlineWidth: number;        // px
  position: CaptionPosition;
  box: boolean;               // 하단 반투명 박스
  karaoke: boolean;           // 단어 하이라이트
  karaokeColor: string;        // 하이라이트 색
}

export interface RenderOptions {
  aspect: CaptionAspect;       // 'original' | '9:16' | '1:1'
  resolution: 720 | 1080;      // Pro만 1080
  style: CaptionStyle;
}

export type RenderStatus = 'pending' | 'rendering' | 'done' | 'failed';
export interface Render {
  id: string; jobId: string; userId: string | null;
  status: RenderStatus;
  aspect: CaptionAspect; resolution: number; watermark: boolean;
  style: CaptionStyle;
  outputStorageKey: string | null;
  errorMessage: string | null;
  createdAt: Date; finishedAt: Date | null; outputDeleteAt: Date | null;
}
```

### 3.2 `renders` 테이블

```sql
create table public.renders (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','rendering','done','failed')),
  aspect text not null default 'original',
  resolution int not null default 720,
  watermark boolean not null default true,
  style jsonb not null,
  output_storage_key text,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  output_delete_at timestamptz
);
create index renders_job_idx on public.renders (job_id, created_at desc);
alter table public.renders enable row level security;
-- 본인 잡의 렌더만 조회 (워커 쓰기는 admin 우회)
create policy "renders_owner_select" on public.renders for select
  using (exists (select 1 from public.jobs j
    where j.id = renders.job_id and j.owner_type='user' and j.user_id = auth.uid()));
```

### 3.3 `user_profiles.is_pro`

```sql
alter table public.user_profiles
  add column if not exists is_pro boolean not null default false;
-- 결제 연동 전: 수동/관리자 토글. 추후 subscriptions 테이블로 이관 가능
```

### 3.4 Storage

- **`renders` 버킷(NEW, private)**: 출력 MP4. signed URL 다운로드.
- **`subtitles` 버킷**: `{jobId}.words.json`(단어 타이밍) 추가 저장.
- 출력 자동삭제: 무료 즉시(N시간)·회원 N일 (`output_delete_at` + cleanup).

### 3.5 ASS 매핑 규칙

- 색 `#RRGGBB` → ASS `&HBBGGRR&` (역순). 알파 별도.
- 정렬: position → ASS Alignment (bottom=2, middle=5, top=8).
- fontSizePct → PlayResY 기준 px = `round(playResY * pct/100)`.
- 카라오케: words 있으면 Dialogue에 `{\k<cs>}word` (cs=centiseconds=단어길이/10ms). 없으면 평문.

---

## 4. API / Service Spec

### 4.1 Surface

| Type | Name | Change |
|------|------|--------|
| Server Action | `createRender(jobId, options)` | NEW — 게이팅 후 renders 생성 + enqueue, renderId 반환 |
| Route/Action | `getRender(renderId)` | NEW — 상태·다운로드 URL 조회(폴링) |
| Internal | `enqueueRender(renderId)` | NEW — BullMQ `{kind:'render'}` |
| Worker | `processRender(renderId)` | NEW — render.ts |

### 4.2 createRender (services/render)

```typescript
export async function createRender(jobId: string, opts: RenderOptions):
  Promise<{ renderId: string } | { error: string }> {
  // 1) 본인 잡 + finished 확인 (server supabase)
  // 2) 게이팅: is_pro=false → watermark=true, resolution=min(720)
  //    is_pro=true → 옵션대로(<=1080)
  // 3) renders insert(pending, 강제된 watermark/resolution, style)
  // 4) enqueueRender(renderId)
}
```

- 게이팅은 **여기서 강제**(클라가 보낸 resolution/watermark 무시하고 is_pro 기준 재설정).

### 4.3 getRender (폴링)

```json
{ "ok": true, "data": {
  "status": "rendering",        // pending|rendering|done|failed
  "downloadUrl": null,           // done이면 signed URL
  "errorMessage": null
}}
```

### 4.4 Worker render.ts (의사코드)

```
processRender(renderId):
  r = getRenderAdmin(renderId); job = getJobAdmin(r.jobId)
  set status=rendering
  video = download(job.videoStorageKey)            # tmp
  words = loadWordsJson(job.id) or parseSrt(...)    # cues(+words)
  ass  = buildAss(cues, r.style, playRes)           # lib/ass
  out  = ffmpegBurn(video, ass, {
           aspect: r.aspect, resolution: r.resolution,
           watermark: r.watermark, fontsDir })
  key = uploadRender(renderId, out)                 # renders 버킷
  set status=done, output_storage_key=key, output_delete_at
  (실패 시 status=failed + error_message)
```

### 4.5 ffmpeg 필터 (worker/lib/ffmpeg.ts)

```
-vf "[crop/scale if 9:16|1:1], ass='subs.ass':fontsdir='fonts', [drawtext watermark if free]"
-c:v libx264 -preset veryfast -crf 23 -c:a copy
```
- 9:16: `scale=-2:1920,crop=1080:1920` (중앙) 또는 원본 비율 따라 조정.
- 워터마크(무료): `drawtext=text='make_cc':x=w-tw-20:y=h-th-20:fontcolor=white@0.7:fontsize=...`.
- 큐 분기: 기존 poll-loop에서 `job.data.kind` 검사 → transcribe/render 라우팅. (기존 enqueue도 `kind:'transcribe'`로 명시; 미지정은 transcribe로 간주 = backward-compat)

---

## 5. UI/UX

### 5.1 Editor 확장

```
┌ 편집기 ───────────────────────────────────┐
│ <video> + 자막 미리보기(선택 스타일 반영)    │
├──────────────────────────────────────────┤
│ 자막 스타일                                 │
│  [기본][굵은 노랑][하단 박스][상단][예능]    │ ← TemplatePicker
│  폰트 [Pretendard▾] 크기 [■■□] 색 [●]       │ ← 커스텀
│  위치 (하단) 카라오케 [ON]                   │
├──────────────────────────────────────────┤
│ 내보내기:  비율 [원본|9:16|1:1]  화질 [720|1080(Pro)] │
│  [ 번인 영상 내보내기 ]   (무료: 워터마크 안내) │
└──────────────────────────────────────────┘
→ 클릭 시 RenderProgress(폴링) → 완료 [MP4 다운로드]
```

### 5.2 Components

| Component | 위치 | 책임 |
|-----------|------|------|
| `CaptionStylePanel` | features/editor/components | 템플릿+커스텀 상태 |
| `TemplatePicker` | 〃 | 프리셋 선택 |
| `CaptionPreview` | 〃 | 선택 스타일 미리보기(자막 오버레이 근사) |
| `ExportButton` | 〃 | 비율·화질 선택 + createRender 호출 |
| `RenderProgress` | 〃 | getRender 폴링 + 다운로드 |
| `useCaptionStyle` | features/editor/hooks | 스타일 store |

### 5.3 미리보기 전략

- 정밀 미리보기(ASS 렌더)는 비용 큼 → MVP는 **CSS 오버레이 근사**(폰트·색·위치·박스 반영, 카라오케는 단순 강조)로 "느낌" 확인. 실제 픽셀 일치는 번인 결과로 확정.

---

## 6. Error Handling

| 상황 | 처리 |
|------|------|
| words.json 없음(whisperX 미적용 잡) | 줄 단위 fallback, karaoke 자동 OFF |
| ffmpeg 실패(폰트/필터) | status=failed + error, 편집기 재시도 버튼 |
| 게이팅 위반(클라가 1080 요청, 무료) | 서버에서 720 강제(에러 아님) |
| 렌더 타임아웃 | 워커 제한시간 초과 → failed |
| 동시 렌더 과다 | 큐 동시성 제한 → 대기(pending) |

신규 에러코드 불필요(기존 `INVALID_INPUT`/`NOT_FOUND`/`FORBIDDEN`/`INTERNAL` 재사용).

---

## 7. Security

- [x] 렌더는 **본인 finished 잡만**(server supabase 소유 검증).
- [x] 워터마크·해상도 **서버·워커 강제**(클라 신뢰 안 함) — 수익 누수 방지.
- [x] 출력은 **signed URL**(private renders 버킷).
- [x] 폰트 **OFL/상업이용 가능만**.
- [x] 워커 쓰기는 admin client(기존 패턴).
- [x] 자막 텍스트는 ASS 이스케이프(중괄호 `{}` 주입 방지).

---

## 8. Test Plan

| Type | Target | Tool |
|------|--------|------|
| Unit | `lib/ass`: 색변환·정렬·fontSize·카라오케·이스케이프·fallback | Vitest |
| Unit | `services/render`: 게이팅(무료→watermark/720 강제) | Vitest |
| Integration | createRender → renders insert + enqueue (mock) | Vitest |
| E2E(수동) | 한국어 영상 → 번인 MP4(원본/9:16) 한글 깨짐 0 | manual |
| E2E(수동) | 무료=워터마크+720 / Pro=제거+1080 | manual |

**Critical 케이스**: `#FFCC00` → `&H00CCFF&`, bottom→Alignment 2, karaoke `\k` cs 계산, `{`·`}` 이스케이프, words 없을 때 평문 fallback.

---

## 9. Clean Architecture (Option C 매핑)

| Layer | 책임 | 위치 |
|-------|------|------|
| Presentation | 스타일·내보내기·진행률 | features/editor/{CaptionStylePanel,ExportButton,RenderProgress} |
| Application | 렌더 생성·상태·게이팅 | services/render, app/api/renders |
| Domain (pure) | ASS 생성, 스타일·템플릿, 타입 | lib/ass.ts, types/caption-style.ts |
| Infrastructure | ffmpeg 번인, Storage, DB, 큐 | worker/render.ts, worker/lib/ffmpeg, lib/supabase/admin, services/queue |

---

## 10. Convention

- 색 입력 `#RRGGBB`(UI) ↔ ASS `&HBBGGRR&`(빌더 내부 변환).
- 폰트명: 번들 등록명 `Pretendard`/`NotoSansKR` 정확히 일치(fontconfig).
- renders status 전이: pending→rendering→(done|failed). 직접 done 금지.
- 게이팅 상수: `FREE_MAX_RES=720`, 무료 `watermark=true` — services/render 한 곳.
- import 경계: app→services, services→lib, worker→services/lib (기존 ESLint 유지).

---

## 11. Implementation Guide

### 11.1 File Structure (변경/신규)

```
src/
  lib/
    ass.ts                         (NEW — pure ASS 빌더)
  types/
    caption-style.ts               (NEW)
    subtitle.ts                    (수정 — Cue.words)
    job.ts                         (수정 — Render 타입 export 위치 검토)
  services/render/
    index.ts                       (NEW)
    service.ts                     (NEW — createRender/getRender/게이팅)
  app/api/renders/
    route.ts                       (NEW — POST 생성)
    [renderId]/route.ts            (NEW — GET 상태)
  features/editor/components/
    CaptionStylePanel.tsx          (NEW)
    TemplatePicker.tsx             (NEW)
    CaptionPreview.tsx             (NEW)
    ExportButton.tsx               (NEW)
    RenderProgress.tsx             (NEW)
  features/editor/hooks/
    useCaptionStyle.ts             (NEW)
  features/editor/lib/
    caption-templates.ts           (NEW — 프리셋 3~5)
worker/
  render.ts                        (NEW — 번인 렌더 핸들러)
  lib/ffmpeg.ts                    (수정 — ass/crop/watermark)
  fonts/                           (NEW — Pretendard/NotoSansKR OFL)
  cli/poll-loop.ts                 (수정 — kind 분기)
  transcribe.ts                    (수정 — words.json 저장)
supabase/migrations/
  *_renders.sql                    (NEW — renders + is_pro)
src/services/storage/             (수정 — renders 버킷 + words.json + presign)
tests/unit/lib/ass.spec.ts        (NEW)
tests/unit/services/render/*.spec.ts (NEW)
```

### 11.2 Implementation Order

1. [ ] **타이밍+타입+DB**: Cue.words + caption-style 타입 + renders 마이그레이션 + is_pro + 폰트 번들 + words.json 저장(transcribe)
2. [ ] **ASS 빌더**: lib/ass.ts + 단위테스트
3. [ ] **워커 렌더**: worker/render.ts + ffmpeg(ass/crop/watermark) + renders 버킷 + 큐 kind 분기
4. [ ] **렌더 서비스/API**: services/render(게이팅) + /api/renders + 폴링
5. [ ] **편집기 UI**: 스타일 패널 + 템플릿 + 미리보기 + 내보내기 + 진행률
6. [ ] **게이팅·삭제·QA**: is_pro 분기 검증 + 출력 자동삭제 + 한국어 영상 QA

### 11.3 Session Guide

> Auto-generated. `/pdca do burnin-captions --scope module-N`.

#### Module Map

| Module | Scope Key | Description | Turns |
|--------|-----------|-------------|:-----:|
| 타이밍·타입·DB·폰트 | `module-1` | `Cue.words` + `types/caption-style.ts` + `renders` 마이그레이션 + `user_profiles.is_pro` + OFL 폰트(Pretendard/NotoSansKR) 번들 + transcribe가 `{jobId}.words.json` 저장 + renders 버킷 | 25-30 |
| ASS 빌더 | `module-2` | `lib/ass.ts`(pure: 색변환·정렬·fontSize·카라오케 `\k`·이스케이프·fallback) + `tests/unit/lib/ass.spec.ts`(10+ 케이스) | 25-30 |
| 워커 렌더 | `module-3` | `worker/render.ts`(video+words→ass→ffmpeg 번인) + `worker/lib/ffmpeg.ts` 확장(`-vf ass`+9:16 crop+watermark drawtext) + renders 버킷 업로드 + `poll-loop` kind 분기 + 한글 1회 PoC | 35-40 |
| 렌더 서비스·API | `module-4` | `services/render`(createRender 게이팅·getRender) + `/api/renders` POST·GET + enqueue + 단위테스트(게이팅) | 25-30 |
| 편집기 UI | `module-5` | `CaptionStylePanel`+`TemplatePicker`+`CaptionPreview`(CSS 근사)+`ExportButton`(비율·화질)+`RenderProgress`(폴링)+`useCaptionStyle`+`caption-templates`(프리셋 5종) | 35-40 |
| 게이팅·삭제·QA | `module-6` | is_pro 분기 서버·워커 강제 검증 + 출력 자동삭제(cleanup 확장) + 한국어 영상 2~3개 QA(원본/9:16, 무료/Pro) | 20-25 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| 1 | Plan+Design | 전체 | 완료 |
| 2 | Do | `module-1,module-2` (타이밍·타입·DB + ASS 빌더) | 50-60 |
| 3 | Do | `module-3` (워커 렌더 — 병목, libass·폰트 PoC 선행) | 40-50 |
| 4 | Do | `module-4,module-5` (서비스/API + 편집기 UI) | 60-70 |
| 5 | Do+Check | `module-6` + `/pdca analyze` | 35-45 |

**병목 식별**: `module-3` — 워커 환경의 **libass·폰트(fontconfig) 사용 가능 여부**가 전제. **사전 PoC**: `ffmpeg -i in.mp4 -vf "ass=test.ass:fontsdir=fonts" out.mp4`로 한글 1회 렌더 성공 확인 후 진행. 실패 시 libass 빌드/폰트 등록부터.

**전제 의존성**: 단어 타이밍은 **whisperX**(speaker-diarization) 산출물. speaker-diarization이 whisperX를 아직 안 붙였으면 module-1에 word-timestamp 추출을 포함(없으면 줄단위 fallback로도 출시 가능 — 카라오케만 비활성).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-06-16 | Initial draft — Option C(renders 분리 + 기존 큐/워커 재사용), ASS 번인 파이프라인, 게이팅, 6 모듈/5 세션 | shong7500 |
