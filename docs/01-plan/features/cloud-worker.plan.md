---
template: plan
version: 1.0
feature: cloud-worker
date: 2026-06-24
author: shong7500
project: make_cc
status: Draft
phase: phase-4
---

# 클라우드 워커(STT) Planning Document — 수익화 선결 인프라

> **Summary**: STT가 로컬 GPU PC(`poll-loop`)에 묶여 PC가 꺼지면 서비스가 중단된다 — 유료화의 최대 장애물. STT를 **RunPod Serverless GPU**(scale-to-zero·초당 과금)로 옮기고, 잡 생성 시 **Push 트리거**로 호출 → 컨테이너가 처리 후 Supabase에 write-back. 로컬 워커는 dev·폴백으로 유지.
>
> **Project**: make_cc · **Date**: 2026-06-24 · **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | STT 처리가 로컬 GPU PC의 `poll-loop`에 의존 → PC가 꺼지면 자막 생성 중단. 유료 고객에게 "내 컴퓨터가 켜져 있어야만 동작"은 SLA 불가 → **수익화의 선결 장애물.** |
| **Solution** | STT를 **RunPod Serverless GPU**로 이전. 잡이 `queued`되면 디스패처가 RunPod 엔드포인트를 **Push 호출**, 컨테이너가 기존 `processTranscribe` 로직을 그대로 실행하고 Supabase에 write-back. scale-to-zero로 유휴 비용 ≈ $0. |
| **Function/UX Effect** | 사용자는 아무 때나 업로드 → 항상 처리됨(워커 PC 무관). 처리 상태는 기존 SSE/폴링 그대로. |
| **Core Value** | **유료 서비스 가동 신뢰성(24/7)** + 저트래픽 최소 비용(영상당 수 센트, 유휴 0). 기존 워커 코드 최대 재사용. |

조사 근거: [RunPod Serverless 가격(scale-to-zero·초당)](https://docs.runpod.io/serverless/pricing), [저트래픽 비교(RunPod vs vast)](https://deploybase.ai/articles/runpod-vs-vastai). 2026-06-24 조사.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 로컬 PC 의존 → 가동 불안정 → 유료화 불가. 24/7 신뢰성 확보가 수익화 선결 조건. |
| **WHO** | (내부) 운영자 = 사용자 본인. (외부) STT를 기다리는 모든 이용자, 특히 향후 Pro 고객. |
| **RISK** | ① 컨테이너화 복잡(Node+Python+ffmpeg+GPU) ② 콜드스타트 지연 ③ 시크릿(서비스롤) 노출 ④ 중복 처리(로컬+클라우드) ⑤ RunPod 비용 폭주 ⑥ write-back 실패 시 잡 stuck. |
| **SUCCESS** | 로컬 워커 꺼진 상태에서 업로드 → RunPod이 자동 처리 → `finished` + SRT 생성 E2E. 유휴 시 GPU 과금 0. 로컬 폴백으로 전환 가능. |
| **SCOPE** | IN: STT의 RunPod 이전(컨테이너·Push 디스패처·write-back·멱등·비용가드). OUT(후속): 번역 경량화 경로, 렌더 이전, 자동 스케일 튜닝, 다중 리전. |

---

## 목표 / 비목표

**목표 (phase4 / cloud-worker)**
- STT를 RunPod Serverless GPU로 이전, **로컬 PC 없이 24/7 처리**
- 잡 `queued` → **Push 트리거**(디스패처가 RunPod `/run` 호출) → 컨테이너가 write-back
- **기존 워커 코드 재사용**: 컨테이너에서 `node worker/cli/process-one.ts <jobId>` 실행(= 기존 `processTranscribe`)
- **중복 처리 방지**: 기존 claim 가드(`queued→transcribing`) 활용 — 로컬·클라우드 누가 먼저 잡든 1회만
- **로컬 폴백 유지**: 장애 시 로컬 `poll-loop`로 전환
- **비용 가드**: RunPod 지출 상한 + 잡당 타임아웃

**비목표 (이연)**
- **번역 경량 경로**(GPU 불필요) — 별도 후속(인라인 or CPU 엔드포인트). 이번엔 STT 집중.
- 번인 렌더 RunPod 이전 (현상 유지)
- 결제/구독 연동(별도 feature)
- 멀티 리전·고급 오토스케일

---

## 핵심 설계 결정 (사용자 확정)

| 항목 | 결정 |
|------|------|
| 범위 | **STT만** RunPod. 번역=경량(GPU X, 후속), 렌더=현상 유지 |
| 제공자 | **RunPod Serverless GPU** (scale-to-zero, 초당 과금) |
| 트리거 | **Push** — 잡 `queued` 시 디스패처가 RunPod 호출 → write-back |
| 로컬 워커 | **dev·폴백 유지** (claim 가드로 중복 방지) |

---

## 우선순위 로드맵

### 🔴 P0 — STT 클라우드 이전 (E2E 최소 동작)

#### P0-1. RunPod 컨테이너 (이미지 + 핸들러)
- `Dockerfile`(worker용): Node + Python(faster-whisper·pyannote·torch CUDA) + ffmpeg + `worker/fonts` + 리포 코드.
- RunPod serverless **핸들러**(python `handler.py`): `{ "input": { "jobId": "..." } }` 수신 → `node worker/cli/process-one.ts <jobId>` 실행 → 종료코드/요약 반환.
- 시크릿: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `HUGGINGFACE_TOKEN`, `WHISPER_*` 를 RunPod 엔드포인트 env로 주입.
- 모델 가중치: 이미지에 사전 다운로드(콜드스타트 단축) or 네트워크 볼륨.

#### P0-2. Push 디스패처
- `src/lib/runpod.ts`(신규): RunPod REST 클라(`/v2/{endpointId}/run` async 호출). 외부 패키지+env만.
- `src/lib/env.ts`: `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `STT_DISPATCH`(`runpod`|`local` 토글) 추가.
- `services/`(예: `services/stt-dispatch`): 잡 `queued` 전이 직후 RunPod `/run` fire-and-forget 호출(실패해도 로컬 폴백이 잡음 — graceful).
- 호출 지점: 업로드 완료 라우트(`app/api/uploads/[uploadId]/complete`)에서 `markUploaded`(=queued) 후 디스패치.

#### P0-3. write-back / 멱등 / 실패 처리
- 컨테이너의 `process-one`이 기존 `processTranscribe` 그대로 사용 → `markTranscribing`(claim 가드)·SRT 업로드·`markFinished`·`job_events` 전부 재사용.
- **중복 방지**: claim 가드로 로컬·RunPod 동시 픽업해도 1회만 처리(이미 구현됨).
- **실패**: 컨테이너 오류 → 잡 `queued` 유지(또는 `failed`) → 로컬 폴백/재시도. RunPod 재시도 정책 설정.

### 🟡 P1 — 운영 안정화
- **P1-1. 비용 가드**: RunPod 엔드포인트 최대 워커 수·잡당 실행시간 상한, 지출 알림. env로 동시성 제한.
- **P1-2. 모니터링**: 처리 실패/지연 시 기존 Discord 웹훅 재활용(워커 다운 알림 패턴). RunPod 잡 상태 로깅.
- **P1-3. 로컬 폴백 문서화**: `STT_DISPATCH=local`로 즉시 회귀하는 운영 절차.

### 🟢 P2 — 후속(별도 판단)
- **P2-1. 번역 경량 경로**: 번역(DeepL, GPU 불필요)을 24/7로 — 인라인 서버리스(긴 영상 타임아웃 주의) or CPU 엔드포인트 or 경량 상시 워커.
- **P2-2. 렌더 RunPod 이전**(CPU/GPU 엔드포인트).
- **P2-3. 콜드스타트 튜닝**(FlashBoot·웜풀), 비용 리포트 대시보드(first-party 분석 연계).

---

## 추천 시퀀스
1. **P0-1**(컨테이너+핸들러) — PoC: 로컬에서 이미지 빌드→RunPod 배포→수동 `/run`으로 1건 처리 검증
2. **P0-2**(디스패처) → **P0-3**(멱등·실패) — 잡 생성 자동 트리거 E2E
3. **P1**(비용가드·모니터링·폴백 문서)
4. (수익화 진행 시) **P2-1 번역 경량 경로**

---

## 검증 항목 사전 확인 (착수 전)
- `worker/cli/process-one.ts`가 jobId 인자로 `processTranscribe(jobId)` 1건 처리하는지(=핸들러가 그대로 호출 가능한지).
- claim 가드(`markTranscribing` `queued→transcribing`)가 동시 픽업 1회만 보장하는지(중복 방지 핵심).
- 업로드 완료 라우트에서 queued 전이 지점 — 디스패치 삽입 위치.
- 컨테이너 이미지 크기/콜드스타트(모델 사전탑재 vs 네트워크 볼륨) 트레이드오프.
- RunPod이 Supabase Storage(영상 다운로드)·DB write에 도달하는 네트워크/시크릿 구성.

---

## 위험 & 완화
| 위험 | 완화 |
|------|------|
| 컨테이너화 복잡 | 기존 코드 재사용(handler→`process-one`), 단계적 PoC 우선 |
| 콜드스타트 지연 | 모델 이미지 사전탑재 + FlashBoot. STT는 비실시간이라 수초 지연 허용 |
| 시크릿 노출 | 서비스롤은 RunPod 엔드포인트 env에만(클라 노출 0). 최소 권한 |
| 중복 처리 | claim 가드(이미 구현) — 동시 픽업해도 1회 |
| 비용 폭주 | 최대 워커 수·잡당 타임아웃·지출 알림(P1-1) |
| write-back 실패 잡 stuck | 실패 시 `failed`/재시도 + 로컬 폴백 + Discord 알림 |
| 로컬↔클라우드 전환 | `STT_DISPATCH` 토글 + 폴백 절차 문서 |

---

## 성공 기준 (Success Criteria)
1. 로컬 워커 **꺼진 상태**에서 업로드 → RunPod 자동 처리 → `finished` + SRT 생성(E2E).
2. 유휴 시 GPU 과금 **0**(scale-to-zero 확인).
3. 동시 픽업(로컬+RunPod)에도 **중복 처리 0**(claim 가드).
4. `STT_DISPATCH=local`로 **즉시 폴백** 가능.
5. 잡당 비용 측정 가능(영상 길이 대비 처리시간·비용 로깅).

---

## Do 단계 준비물(사용자)
- **RunPod 계정** + Serverless 엔드포인트 생성 + API 키.
- 컨테이너 레지스트리(RunPod 또는 Docker Hub) 접근.
- RunPod 엔드포인트 env: Supabase URL/서비스롤, HF 토큰, Whisper 설정, (필요시) FFMPEG 경로.
- 지출 상한/알림 설정.
