#!/usr/bin/env python3
"""
Whisper + Speaker Diarization runner.

faster-whisper(STT) + pyannote.audio(diarization)를 직접 조합한다.
whisperX 패키지 의존성 회피 — 우리 한국어 / Python 3.13 환경 안전.

Usage:
  python whisperx.py <model> <audio_path> [language] [device]

Env:
  HUGGINGFACE_TOKEN     — pyannote 모델 다운로드 인증 (필수, 없으면 fallback)
  WHISPER_DIARIZATION   — 'true'/'false' (default true)
  WHISPER_MIN_SPEAKERS  — pyannote 힌트 (default 1)
  WHISPER_MAX_SPEAKERS  — pyannote 힌트 (default 10)

stdout (line-delimited JSON):
  {"type": "info", "message": ...}
  {"type": "segment", "start": float, "end": float, "text": str, "speaker": str|null,
   "words": [{"start": float, "end": float, "text": str}, ...]}
  {"type": "done", "duration": float, "language": str, "elapsed": float, "diarized": bool}
  {"type": "error", "message": str}     (exit 1)

graceful degrade:
  - HF 토큰 없거나 pyannote 로드 실패 → 일반 STT만 수행 (speaker = null)
  - WHISPER_DIARIZATION=false → diarization 건너뜀
"""
import os
import sys
import json
import time


# Windows에서 Python stdout 기본 인코딩이 cp949일 수 있어 한국어가 깨짐.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


# Windows: nvidia-cublas-cu12 / nvidia-cudnn-cu12 PyPI 패키지의 DLL 디렉터리 등록
if sys.platform == "win32":
    try:
        import site
        candidates = list(site.getsitepackages())
        try:
            candidates.append(site.getusersitepackages())
        except Exception:
            pass

        added_paths = []
        for site_dir in candidates:
            for pkg in ("cublas", "cudnn", "cuda_runtime", "cuda_nvrtc"):
                dll_dir = os.path.join(site_dir, "nvidia", pkg, "bin")
                if os.path.isdir(dll_dir):
                    try:
                        os.add_dll_directory(dll_dir)
                    except Exception:
                        pass
                    added_paths.append(dll_dir)
        if added_paths:
            os.environ["PATH"] = os.pathsep.join(added_paths) + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def extract_words(seg):
    """faster-whisper segment → [{start, end, text}]. word_timestamps off면 []."""
    words = []
    for w in getattr(seg, "words", None) or []:
        text = (w.word or "").strip()
        if not text or w.start is None or w.end is None:
            continue
        words.append({"start": float(w.start), "end": float(w.end), "text": text})
    return words


def main():
    if len(sys.argv) < 3:
        emit({"type": "error", "message": "Usage: whisperx.py <model> <audio> [language] [device]"})
        sys.exit(1)

    model_name = sys.argv[1]
    audio_path = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "ko"
    requested_device = sys.argv[4] if len(sys.argv) > 4 else "auto"

    diarize_enabled_env = os.environ.get("WHISPER_DIARIZATION", "true").lower()
    diarize_enabled = diarize_enabled_env in ("true", "1", "yes")
    hf_token = os.environ.get("HUGGINGFACE_TOKEN", "").strip()
    min_speakers = int(os.environ.get("WHISPER_MIN_SPEAKERS", "1"))
    max_speakers = int(os.environ.get("WHISPER_MAX_SPEAKERS", "10"))

    # =========================================
    # 1. faster-whisper STT
    # =========================================
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        emit({"type": "error", "message": f"faster-whisper 미설치 ({e}). pip install faster-whisper"})
        sys.exit(1)

    device, compute_type = pick_device(requested_device)
    emit({"type": "info", "message": f"loading whisper model={model_name} device={device} compute={compute_type}"})

    load_start = time.time()
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as e:
        if device == "cuda":
            emit({"type": "info", "message": f"CUDA 로드 실패 ({e}), CPU 폴백"})
            device, compute_type = "cpu", "int8"
            model = WhisperModel(model_name, device=device, compute_type=compute_type)
        else:
            emit({"type": "error", "message": f"모델 로드 실패: {e}"})
            sys.exit(1)
    emit({"type": "info", "message": f"whisper loaded in {time.time() - load_start:.1f}s"})

    transcribe_start = time.time()
    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=True,  # 번인 카라오케용 단어 단위 타임스탬프
    )
    # generator → list (diarization과 매핑 필요)
    segments = []
    for seg in segments_iter:
        segments.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
            "words": extract_words(seg),
        })
    stt_elapsed = time.time() - transcribe_start
    emit({"type": "info", "message": f"STT complete: {len(segments)} segments in {stt_elapsed:.1f}s"})

    # =========================================
    # 2. pyannote.audio Diarization (옵션)
    # =========================================
    diarized = False
    if not diarize_enabled:
        emit({"type": "info", "message": "diarization 비활성 (WHISPER_DIARIZATION=false)"})
    elif not hf_token:
        emit({"type": "info", "message": "HUGGINGFACE_TOKEN 미설정 — diarization 건너뜀 (STT만 수행)"})
    else:
        try:
            from pyannote.audio import Pipeline
            emit({"type": "info", "message": "loading pyannote diarization pipeline"})
            diarize_start = time.time()
            # pyannote.audio 4.x → community-1 모델 + token= 파라미터
            # pyannote.audio 3.x → speaker-diarization-3.1 + use_auth_token=
            # 우리는 4.x 기준이지만 graceful fallback 시도
            try:
                pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-community-1",
                    token=hf_token,
                )
            except TypeError:
                # 3.x 호환
                pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=hf_token,
                )
            # GPU로 옮기기 (가능하면)
            if device == "cuda":
                try:
                    import torch
                    pipeline.to(torch.device("cuda"))
                except Exception as e:
                    emit({"type": "info", "message": f"pyannote GPU 이동 실패 ({e}), CPU로 진행"})

            emit({"type": "info", "message": f"pipeline loaded in {time.time() - diarize_start:.1f}s"})

            # diarization 실행
            # Windows + pyannote.audio 4.x는 torchcodec 의존 → ffmpeg full-shared DLL 없으면 실패.
            # 우회: soundfile로 wav를 직접 텐서로 로드해서 pipeline에 넘김 (torchcodec 미사용).
            # 워커는 어차피 ffmpeg로 16kHz mono PCM wav 추출 후 호출하므로 안전.
            diar_run_start = time.time()
            try:
                import soundfile as sf
                import torch as _torch
                wav, sr = sf.read(audio_path, dtype="float32", always_2d=False)
                if wav.ndim > 1:
                    wav = wav.mean(axis=1)
                wav_tensor = _torch.from_numpy(wav).unsqueeze(0)  # (1, samples)
                if device == "cuda":
                    wav_tensor = wav_tensor.to("cuda")
                diarization = pipeline(
                    {"waveform": wav_tensor, "sample_rate": sr},
                    min_speakers=min_speakers,
                    max_speakers=max_speakers,
                )
            except ImportError:
                # soundfile 없으면 파일 경로 그대로 (torchcodec 동작 환경 가정)
                diarization = pipeline(
                    audio_path,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers,
                )
            emit({"type": "info", "message": f"diarization done in {time.time() - diar_run_start:.1f}s"})

            # diarization 결과 → list of (start, end, speaker)
            # pyannote 4.x: DiarizeOutput.speaker_diarization → Annotation
            # pyannote 3.x: Pipeline 반환값 자체가 Annotation
            annotation = getattr(diarization, "speaker_diarization", diarization)
            turns = []
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                turns.append((float(turn.start), float(turn.end), str(speaker)))

            # STT segment마다 가장 많이 겹치는 화자 할당
            for seg in segments:
                best_speaker = None
                best_overlap = 0.0
                for t_start, t_end, t_speaker in turns:
                    overlap = min(seg["end"], t_end) - max(seg["start"], t_start)
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_speaker = t_speaker
                seg["speaker"] = best_speaker  # 'SPEAKER_00', 'SPEAKER_01', ... or None

            diarized = True
            unique_speakers = sorted({s["speaker"] for s in segments if s.get("speaker")})
            emit({
                "type": "info",
                "message": f"speakers assigned: {len(unique_speakers)} ({', '.join(unique_speakers) or 'none'})",
            })
        except ImportError as e:
            emit({"type": "info", "message": f"pyannote 미설치 ({e}) — STT만 진행. pip install pyannote.audio"})
        except Exception as e:
            emit({"type": "info", "message": f"diarization 실패 ({e}) — STT만 진행"})

    # =========================================
    # 3. Emit segments
    # =========================================
    for seg in segments:
        speaker_id = seg.get("speaker")
        # pyannote의 'SPEAKER_00' → 'spk_0' (Plan §3.1과 일치)
        if speaker_id and isinstance(speaker_id, str) and speaker_id.startswith("SPEAKER_"):
            try:
                num = int(speaker_id.replace("SPEAKER_", ""))
                speaker_id = f"spk_{num}"
            except ValueError:
                pass

        emit({
            "type": "segment",
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "speaker": speaker_id,  # str or None
            "words": seg.get("words", []),
        })

    emit({
        "type": "done",
        "duration": float(info.duration),
        "language": info.language,
        "elapsed": stt_elapsed,
        "diarized": diarized,
    })


def pick_device(requested: str):
    if requested == "cpu":
        return "cpu", "int8"
    if requested == "cuda":
        return "cuda", "float16"
    try:
        import torch  # type: ignore
        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
    return "cuda", "float16"


if __name__ == "__main__":
    main()
