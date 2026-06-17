#!/usr/bin/env python3
"""
Whisper STT runner — line-delimited JSON output.

Usage:
  python whisper.py <model> <audio_path> [language] [device]

stdout (line-delimited JSON):
  {"type": "info", "message": ...}
  {"type": "segment", "start": float, "end": float, "text": str}
  {"type": "done", "duration": float, "language": str}
  {"type": "error", "message": str}     (exit 1)

stderr는 로그용 (워커가 캡처해서 logger에 흘려 보냄).
"""
import os
import sys
import json
import time


# Windows에서 Python stdout 기본 인코딩이 cp949일 수 있어 한국어가 깨짐.
# UTF-8 강제 (Python 3.7+).
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


# Windows: nvidia-cublas-cu12 / nvidia-cudnn-cu12 PyPI 패키지의 DLL 디렉터리를
# 명시적으로 등록 (PATH 설정 없이도 CTranslate2가 cuBLAS/cuDNN을 찾도록).
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

        # PATH 환경변수에도 prepend (CTranslate2가 LoadLibrary로 찾을 때 확실히 보이도록)
        if added_paths:
            os.environ["PATH"] = os.pathsep.join(added_paths) + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass  # 폴백은 CPU


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def main():
    if len(sys.argv) < 3:
        emit({"type": "error", "message": "Usage: whisper.py <model> <audio> [language] [device]"})
        sys.exit(1)

    model_name = sys.argv[1]
    audio_path = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "ko"
    requested_device = sys.argv[4] if len(sys.argv) > 4 else "auto"

    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        emit({
            "type": "error",
            "message": f"faster-whisper 미설치 ({e}). pip install faster-whisper 실행."
        })
        sys.exit(1)

    # device 자동 결정
    device, compute_type = pick_device(requested_device)
    emit({
        "type": "info",
        "message": f"loading model={model_name} device={device} compute_type={compute_type}",
    })

    load_start = time.time()
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as e:
        # CUDA 실패 시 CPU 폴백
        if device == "cuda":
            emit({"type": "info", "message": f"CUDA 로드 실패 ({e}), CPU 폴백"})
            device, compute_type = "cpu", "int8"
            model = WhisperModel(model_name, device=device, compute_type=compute_type)
        else:
            emit({"type": "error", "message": f"모델 로드 실패: {e}"})
            sys.exit(1)
    emit({
        "type": "info",
        "message": f"model loaded in {time.time() - load_start:.1f}s",
    })

    # transcribe (lazy generator → segment마다 즉시 emit)
    transcribe_start = time.time()
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    for seg in segments:
        emit({
            "type": "segment",
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
        })

    emit({
        "type": "done",
        "duration": float(info.duration),
        "language": info.language,
        "elapsed": time.time() - transcribe_start,
    })


def pick_device(requested: str):
    """requested: 'auto' | 'cuda' | 'cpu'"""
    if requested == "cpu":
        return "cpu", "int8"
    if requested == "cuda":
        return "cuda", "float16"
    # auto: try cuda by probing torch / fallback
    try:
        import torch  # type: ignore
        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
    # CTranslate2 단독으로 CUDA 검사 어렵 → 시도 후 실패 시 CPU 폴백 (caller에서 처리)
    return "cuda", "float16"


if __name__ == "__main__":
    main()
