---
template: plan
version: 1.0
feature: phase-2
date: 2026-06-23
author: shong7500
project: make_cc
status: Draft
---

# Phase 2 Planning Document

> **Summary**: Phase 1(업로드→STT→편집→번인→공유)이 동작하는 상태에서, 실제 사용자 관점의 UX 구멍과 기능 공백을 메워 "쓸 만한 제품"에서 "믿고 쓰는 제품"으로 끌어올린다. **최우선 축은 모바일/반응형.**
>
> **Project**: make_cc · **Date**: 2026-06-23 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Phase 1은 데스크톱 happy-path 위주로 완성됨. 모바일에서 에디터가 사실상 사용 불가, 대용량 업로드 실패, dev 전용 경고 노출, 피드백/에러 처리 불일치 등으로 실사용 이탈 위험이 크다. |
| **Solution** | 모바일 반응형을 1순위로, 신뢰성·피드백·파워 기능을 단계적으로 보강. 이후 수익화(결제)·확장(VTT·다국어)로 진행. |
| **Core Value** | "폰에서도 끝까지 되는" 제품 + 실패·혼란 없는 매끄러운 흐름. |

조사 근거: 2026-06-23 UX 서베이 + 기능/코드 서베이 2건(본 문서 말미 부록).

---

## 목표 / 비목표

**목표 (Phase 2)**
- 모바일에서 업로드·편집·이력·공유 전 과정이 무리 없이 동작
- 프로덕션에서 dev 전용 정보 비노출, 일관된 에러/피드백(토스트·스켈레톤)
- 대용량(회원 1GB) 업로드 안정화(resumable)
- 에디터 파워 기능(키보드·Undo·찾기바꾸기) + VTT 내보내기

**비목표 (Phase 3+로 이연)**
- 팀 협업/역할 기반 권한
- SMS 알림, 고급 번역 파이프라인(번역 자막은 P2 후보로만)
- 자체 결제 게이트웨이(외부 PG 연동만)

---

## 우선순위 로드맵

### 🔴 P0 — 실사용 차단 요소 (먼저)

#### P0-1. 에디터 모바일 반응형 ⭐ (이번 Phase 최우선)
- **문제**: `EditorLayout`이 영상+자막 2-pane 고정 그리드(`lg:grid-cols-[1fr_minmax(360px,420px)]`)라 폰에서 영상이 짓눌리고 자막 리스트가 못 읽힘. 번인 스타일 패널·내보내기도 좁은 화면 미고려.
- **해결**: `<lg` 구간에서 **탭 전환(영상 / 자막 / 스타일)** 또는 스택 + 스티키 영상. 탭 컴포넌트 신규(`features/editor/components/EditorTabs.tsx`). 터치 타깃 ≥44px, 모달/패널 `max-w-[100vw]` 오버플로 방지.
- **영향 파일**: `src/features/editor/components/EditorLayout.tsx`, `CueList.tsx`, `CaptionStylePanel.tsx`, `ExportButton.tsx`, `VideoPlayer.tsx`
- **수용 기준**: 360px 폭에서 영상 재생·자막 클릭편집·스타일 변경·내보내기 모두 가능, 가로 스크롤 없음.

#### P0-2. dev 전용 경고의 프로덕션 노출 제거 (1줄급, 즉시)
- **문제**: 큐 30s 정체 시 "`npm run worker:poll` 실행" 안내가 일반 사용자에게 노출 → 시스템 오류처럼 보임.
- **해결**: `process.env.NODE_ENV === 'development'` 가드. 프로덕션은 "처리가 지연되고 있어요. 잠시 후 다시 확인해 주세요"로 대체.
- **영향 파일**: `src/features/upload/components/JobProgress.tsx`
- **수용 기준**: prod 빌드에서 worker 명령 문구 미노출.

#### P0-3. Resumable 업로드(TUS/chunked)
- **문제**: 단일 PUT XHR이라 회원 1GB 영상이 모바일·불안정망에서 실패. 사실상 대용량 미사용.
- **해결**: Supabase Storage resumable(TUS) 업로드로 전환(청크+이어올리기). 진행률·재시도 UI 연동.
- **영향 파일**: `src/lib/storage.ts`, `src/features/upload/components/UploadFlow.tsx`, 업로드 init/complete API
- **수용 기준**: 100MB+ 업로드 중 네트워크 끊김 후 이어서 완료.

### 🟡 P1 — 파워 & 신뢰성

- **P1-1. 토스트 + 로딩 스켈레톤 + 에러 통일**: 공용 `ErrorAlert`/`Toast`(sonner) 도입, 저장·내보내기·다운로드·삭제 피드백. Jobs/Editor/Share 스켈레톤.
- **P1-2. 에디터 파워**: ↑↓ 큐 이동, Ctrl+Z/Y Undo·Redo(`useSubtitleStore` 히스토리 스택), 찾기·바꾸기, 편집모드 시각 강화.
- **P1-3. 삭제 확인 모달**: `window.confirm` → 디자인 일치 모달.
- **P1-4. 이력 페이지**: 페이지네이션/load-more, 진행중 잡 진행률·만료 임박 배지.
- **P1-5. VTT 내보내기**: 파서는 있고 빌더만 없음 → `buildVTT` + 다운로드 라우트(빠른 득점).
- **P1-6. 큰 자막 리스트 가상화**(600+ cue) + **화자 이름 변경 UI** 완성(module-3 잔여).

### 🟢 P2 — 수익화 & 확장
- **P2-1. 결제/Pro 티어**: 게이팅 코드는 존재 → Toss/Stripe 연동 + 웹훅.
- **P2-2. 다국어**(Whisper en 등) + 번역 자막.
- **P2-3. 계정 사용량 대시보드**(업로드 수·처리시간·업그레이드 유도), 공유 조회수 표시.

---

## 추천 시퀀스
1. **P0-2**(dev 경고 가드) — 즉시 리스크 제거
2. **P0-1**(모바일 에디터) — 최우선 축
3. **P1-1**(토스트/스켈레톤/에러) — 체감 품질
4. **P1-5**(VTT) — 빠른 득점
5. **P0-3**(resumable) → 나머지 P1 → P2

---

## 검증 항목 사전 확인 (착수 전 코드 대조 필요)
> 에이전트 서베이 기준이라 일부는 실제와 다를 수 있어 착수 전 확인.
- `/api/jobs` GET(이력) 실재 여부 — 빌드 라우트엔 `/api/jobs`, `/api/account/jobs/[jobId]` 존재. 이력 조회 경로 확정 필요.
- `/api/share` POST/DELETE 라우트 존재 여부.
- 게스트 캡 race(advisory lock) 필요성.

---

## 부록: 조사 요약
- **UX 서베이**: 모바일 에디터 부재(High), dev 경고 노출(High), 로딩 스켈레톤·에러 일관성 부재(High), 에디터 키보드/Undo 부재, 삭제 confirm, 이력 페이지네이션 등.
- **기능 서베이**: Phase 1 완성도 ≈82%(9/11 모듈), QA 매치율 95%. 미구현: resumable 업로드(Critical), VTT, 다국어, 결제, 자동 재시도. 화자 rename UI 잔여.
