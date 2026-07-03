#!/usr/bin/env python3
"""
리치 CC — 오디오 이벤트 감지 runner (sherpa-onnx AudioTagging / AudioSet).

Usage:
  python sound_events.py <model_dir> <audio_wav_path> [device]

입력: 16kHz mono wav (워커 extractAudio 산출물).
동작: 오디오를 창(window)으로 나눠 창마다 AudioTagging top_k → 이벤트 emit.
      임계·라벨매핑·병합은 노드 쪽(sound-events.ts, 순수·테스트)에서 수행.

stdout (line-delimited JSON):
  {"type":"info","message":...}
  {"type":"event","start":float(sec),"end":float(sec),"label":str,"prob":float}
  {"type":"done","duration":float}
  {"type":"error","message":str}   (exit 1)

stderr는 로그용.
"""
import os
import sys
import json
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# 창 파라미터 — 2s 창, 1s hop(50% 겹침)으로 시간 해상도 확보.
WINDOW_S = 2.0
HOP_S = 1.0
TOP_K = 3
# 파이썬 단계 사전 컷(최종 임계는 노드). 매우 약한 것만 버려 전송량 절감.
PROB_FLOOR = 0.30


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    if len(sys.argv) < 3:
        emit({"type": "error", "message": "usage: sound_events.py <model_dir> <audio> [device]"})
        return 1
    model_dir = sys.argv[1]
    audio_path = sys.argv[2]
    device = sys.argv[3] if len(sys.argv) > 3 else "cpu"

    model = os.path.join(model_dir, "model.int8.onnx")
    labels = os.path.join(model_dir, "class_labels_indices.csv")
    if not os.path.isfile(model) or not os.path.isfile(labels):
        emit({"type": "error", "message": f"모델 없음: {model_dir} (다운로드 필요)"})
        return 1

    try:
        import sherpa_onnx
        import soundfile as sf
        import numpy as np
    except Exception as e:
        emit({"type": "error", "message": f"의존성 로드 실패: {e}"})
        return 1

    t0 = time.time()
    try:
        config = sherpa_onnx.AudioTaggingConfig(
            model=sherpa_onnx.AudioTaggingModelConfig(
                zipformer=sherpa_onnx.OfflineZipformerAudioTaggingModelConfig(model=model),
                num_threads=2,
                provider="cpu" if device != "cuda" else "cuda",
            ),
            labels=labels,
            top_k=TOP_K,
        )
        tagger = sherpa_onnx.AudioTagging(config)
    except Exception as e:
        emit({"type": "error", "message": f"AudioTagging 로드 실패: {e}"})
        return 1
    emit({"type": "info", "message": f"AudioTagging 로드 ({time.time()-t0:.1f}s)"})

    try:
        samples, sr = sf.read(audio_path, dtype="float32")
    except Exception as e:
        emit({"type": "error", "message": f"오디오 읽기 실패: {e}"})
        return 1
    if getattr(samples, "ndim", 1) > 1:
        samples = samples[:, 0]
    duration = len(samples) / float(sr) if sr else 0.0

    win = int(WINDOW_S * sr)
    hop = int(HOP_S * sr)
    if win <= 0:
        emit({"type": "error", "message": "잘못된 샘플레이트"})
        return 1

    n_events = 0
    start = 0
    while start < len(samples):
        chunk = samples[start:start + win]
        if len(chunk) < int(0.4 * sr):  # 너무 짧은 꼬리 창 skip
            break
        st = tagger.create_stream()
        st.accept_waveform(sr, chunk)
        try:
            evs = tagger.compute(st)
        except Exception as e:
            emit({"type": "info", "message": f"창 태깅 실패(skip): {e}"})
            start += hop
            continue
        t_start = start / float(sr)
        t_end = min((start + win) / float(sr), duration)
        for e in evs:
            if float(e.prob) >= PROB_FLOOR:
                emit({"type": "event", "start": round(t_start, 3), "end": round(t_end, 3),
                      "label": e.name, "prob": round(float(e.prob), 4)})
                n_events += 1
        start += hop

    emit({"type": "info", "message": f"이벤트 {n_events}개 (elapsed {time.time()-t0:.1f}s)"})
    emit({"type": "done", "duration": round(duration, 3)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
