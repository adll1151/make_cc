#!/usr/bin/env python3
"""
리치 CC용 AudioTagging 모델 다운로드 (sherpa-onnx zipformer-small, AudioSet).

worker/models/ 는 gitignore이므로 최초 1회 이 스크립트로 받는다.
  python worker/scripts/download_audio_tagging.py

모델: sherpa-onnx-zipformer-small-audio-tagging-2024-04-15 (~111MB)
출처: k2-fsa/sherpa-onnx audio-tagging-models 릴리스 (Apache-2.0)
"""
import os
import sys
import tarfile
import urllib.request

NAME = "sherpa-onnx-zipformer-small-audio-tagging-2024-04-15"
URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
    f"audio-tagging-models/{NAME}.tar.bz2"
)
DEST = os.path.join("worker", "models")


def main():
    target = os.path.join(DEST, NAME)
    if os.path.isfile(os.path.join(target, "model.int8.onnx")):
        print(f"이미 존재: {target}")
        return 0
    os.makedirs(DEST, exist_ok=True)
    tar_path = os.path.join(DEST, f"{NAME}.tar.bz2")
    print(f"다운로드: {URL}")
    urllib.request.urlretrieve(URL, tar_path)
    print(f"압축 해제: {tar_path}")
    with tarfile.open(tar_path, "r:bz2") as t:
        t.extractall(DEST)
    os.remove(tar_path)
    print(f"완료: {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
