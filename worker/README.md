# make_cc Worker

STT 워커 — 영상 → 음성 추출(ffmpeg) → 한국어 STT(faster-whisper) → SRT 자막 생성 → Supabase Storage 업로드.

## 사전 요구

1. **Python 3.11~3.13** + pip
2. **ffmpeg + ffprobe** (PATH에 있어야 함)
3. (선택) **NVIDIA GPU + CUDA 11.8+** — CPU 폴백 자동
4. (선택) **Redis** — BullMQ Worker만 필요. CLI 모드는 불필요

## 설치

```powershell
# 1. Python 의존성
pip install -r worker/requirements.txt
# 또는: python -m pip install --user -r worker/requirements.txt

# 2. (이미 설치됨) tsx
# npm install --save-dev tsx
```

## 실행

### A) 로컬 mp4 → STT 즉시 (Redis 불필요, E2E 시연용)

```powershell
npm run worker:ingest -- C:\path\to\video.mp4
```

흐름: 잡 생성 → Storage 업로드 → ffmpeg → Whisper → SRT 저장 → 다운로드 URL 출력.

### B) 이미 있는 jobId 처리 (Redis 불필요)

```powershell
# Supabase 대시보드에서 jobs 행의 id를 복사
npm run worker:once -- <jobId>
```

### C) BullMQ Worker (Redis 필요, 운영 모드)

```powershell
# Redis 준비 (Upstash 무료 티어 또는 로컬)
# .env에 REDIS_URL 설정

npm run worker
```

전송 큐(`transcribe`)에 잡이 들어오면 자동 처리. Ctrl+C로 종료.

## 환경 변수

`.env` 또는 셸:

| 키 | 기본 | 설명 |
|----|------|------|
| `WHISPER_MODEL` | `small` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | `auto` | `auto`, `cuda`, `cpu` |
| `WHISPER_DIARIZATION` | `true` | 화자 분리 켜기. false면 STT만 |
| `WHISPER_MIN_SPEAKERS` | `1` | pyannote 힌트 |
| `WHISPER_MAX_SPEAKERS` | `10` | pyannote 힌트 |
| `HUGGINGFACE_TOKEN` | (없음) | pyannote.audio 다운로드 인증. 없으면 화자 분리 skip |
| `PYTHON` | `python` (Win) / `python3` (Unix) | Python 실행 파일 |

## 화자 분리 (Speaker Diarization) 설정

`pyannote/speaker-diarization-3.1` 모델로 다인 영상에서 화자별로 자막을 라벨링한다.
**1인 영상은 자동으로 라벨 숨김**. 다인은 `[화자 1] 본문` 형식.

### 1. HuggingFace 토큰 발급 (5분, 1회만)

1. https://huggingface.co 가입 (무료)
2. 우측 상단 프로필 → **Settings → Access Tokens**
3. **"+ Create new token"** 클릭
   - Token name: `make-cc-worker` (자유)
   - Token type: **Read** (가장 약한 권한, 안전)
4. 생성된 토큰(`hf_xxxxx...`) **즉시 복사** (한 번만 보임)

### 2. pyannote 모델 약관 동의 (3분, 1회만)

브라우저로 아래 3개 URL **로그인 상태로** 방문 → 각각 "You need to agree..." 회색 박스에서
회사·웹사이트 입력 후 **Submit** 클릭:

- https://huggingface.co/pyannote/segmentation-3.0
- https://huggingface.co/pyannote/speaker-diarization-3.1
- https://huggingface.co/pyannote/speaker-diarization-community-1 (pyannote.audio 4.x 필수)

> `community-1` 모델은 pyannote.audio 4.x가 우선 사용하는 신규 모델입니다.
> 모두 동의해야 안정적으로 동작합니다.

### 3. `.env`에 토큰 추가

```env
HUGGINGFACE_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 4. PyAnnote/Torch 설치

```powershell
pip install --user pyannote.audio
# torch는 pyannote가 자동 설치 (CUDA 휠 사용 시 별도 설치 권장)
```

### 5. 검증

```powershell
npm run worker:ingest -- C:\path\to\multi-speaker-video.mp4
```

로그에 `loading pyannote diarization pipeline` → `diarization done in N.Ns` → `speakers assigned: N` 가 보이면 성공.
HF 토큰이 없거나 약관 미동의 시 `HUGGINGFACE_TOKEN 미설정 — diarization 건너뜀` 로그 후 일반 STT만 수행됨 (graceful degrade).

### 모델별 메모리·정확도 (화자 분리 포함)

| 모델 | VRAM (STT만) | VRAM (+ 화자분리) | 한국어 WER | 처리 속도 |
|------|-------------|-------------------|-----------|----------|
| small | 2GB | ~3.5GB | ~17% | 9~10× realtime |
| medium | 5GB | ~6.5GB | ~13% | 5× realtime |
| large-v3 | 10GB | ~11.5GB | ~10% | 2× realtime |
| **large-v3-turbo** | ~6GB | ~7.5GB | ~10~11% | ~4× realtime |

> 화자 분리가 켜져 있을 때 RTX 4060 8GB에서는 **small + diarization** 또는 **medium + diarization (한계)** 권장.
> GPU 여유가 있으면 **large-v3-turbo** 권장 — large-v3 대비 VRAM ~40%↓·속도 ~2배↑, 정확도 저하 <1%. (리치 CC용 SenseVoice 동거 여지 확보)

### 모델별 메모리·정확도

| 모델 | 크기 | VRAM (fp16) | 한국어 WER | 속도 |
|------|------|-------------|-----------|------|
| tiny | 75MB | 1GB | ~30% | 매우 빠름 |
| base | 145MB | 1GB | ~25% | 빠름 |
| small | 488MB | 2GB | ~17% | 빠름 |
| **medium** | 1.5GB | 5GB | ~13% | 보통 |
| large-v3 | 3GB | 10GB | ~10% | 느림 |
| **large-v3-turbo** | 1.6GB | ~6GB | ~10~11% | 빠름(디코더 4레이어) |

> Plan 목표 WER ≤ 15% → **medium 이상 권장**. small도 시작점으로 OK. GPU면 **large-v3-turbo**가 가성비 최적(속도·VRAM).

## 파이프라인

```
1. jobs 테이블에서 잡 로드 (status: queued|uploading)
2. status: transcribing 전이 + started_at 기록
3. Supabase Storage videos 버킷에서 영상 다운로드 → 임시 디렉터리
4. ffmpeg로 16kHz mono PCM wav 추출
5. whisperx.py (또는 whisper.py — fallback) 스크립트 spawn
   ├ stdout: 라인 단위 JSON
   │   ├ {type:"info", ...}                     → 로그
   │   ├ {type:"segment", start, end, text, speaker}  → cues 누적
   │   └ {type:"done", duration, diarized, ...} → 완료
   └ stderr: 로그 캡처
6. cues → 다인 자동 판정 → SpeakerMap 자동 생성 (1인이면 빈 객체)
7. cues + speakerMap → applyLabels → buildSrt() → SRT 텍스트
8. Supabase Storage subtitles 버킷에 SRT 업로드
9. jobs.speaker_map JSON 컬럼 업데이트
10. status: finished + subtitleStorageKey 기록
11. 임시 파일 정리
```

## 트러블슈팅

### "faster-whisper not installed"
```powershell
pip install --user faster-whisper
```

### "CUDA 로드 실패, CPU 폴백" 로그
- NVIDIA 드라이버 + CUDA 11.8+ 확인
- VRAM 부족이면 `WHISPER_MODEL=small`로
- CPU만 쓰려면 `WHISPER_DEVICE=cpu`

### Whisper가 "cues = 0"
- 영상에 음성이 없음
- 너무 짧은 영상 (< 1초)
- VAD가 너무 공격적 → whisper.py의 `min_silence_duration_ms` 조정

### ffmpeg PATH 못 찾음
- ffmpeg를 PATH에 등록 (또는 `worker/lib/ffmpeg.ts`에서 절대 경로 사용)

### Python 명령 못 찾음
- Windows: `python` 또는 `py` 시도
- `PYTHON=py` 환경 변수로 명시 가능

### 화자 분리 안 됨 (`HUGGINGFACE_TOKEN 미설정` 로그)
- `.env`에 `HUGGINGFACE_TOKEN=hf_xxxx` 추가
- pyannote 모델 약관 동의 확인 (위 "화자 분리 설정" §2)
- 워커 재시작

### 화자 분리 시 `gated repo` 또는 `403 Forbidden`
- pyannote 약관 동의 페이지 다시 방문 → 동의 후 약 5분 대기 (HF 캐시)
- 토큰 권한이 Read 이상인지 확인

### `pyannote 미설치` 로그
```powershell
pip install --user pyannote.audio
```

## TODO (다음 모듈)

- module-3: worker Node 통합 (whisperx.py 호출 + speakerMap 자동 생성)
- module-4: /api/subtitles 라우트 확장 (speakerMap 수용)
- module-5: 편집기 화자 라벨 토글 + 이름 매핑 UI
- module-6: 랜딩 카피 "CC" 복원
- module-11: Dockerfile + GPU 노드 배포
