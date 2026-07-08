'use client';

/**
 * 섬네일 추천 — Tier B AI(얼굴 감지). Design §4 m3.
 *
 * BlazeFace(@tensorflow-models/face-detection, tfjs 런타임)를 **lazy 동적 import**로
 * 로드해 프레임별 얼굴 신호(존재·크기·중앙성)를 낸다. 로드/추론 실패 시 graceful →
 * 호출부는 Tier A(휴리스틱)로 성립. 채점 결합은 thumbnail-score.combineScore(가중 재정규화).
 *
 * NIMA 미학(signals.aesthetic)은 가중치 오프라인 변환·호스팅이 선행 필요 → m3.2 이연.
 */

/** face-detection detector의 최소 형태(런타임 타입 결합 회피). */
interface FaceDetectorLike {
  estimateFaces(
    input: ImageData | HTMLCanvasElement | HTMLVideoElement,
    opts?: { flipHorizontal?: boolean },
  ): Promise<Array<{ box: { xMin: number; yMin: number; width: number; height: number } }>>;
}

export interface RawFaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

let detectorPromise: Promise<FaceDetectorLike | null> | null = null;

/**
 * 얼굴 감지기 lazy 로드(1회 캐시). 실패 시 null(무해 강등).
 * tfjs-core + webgl 백엔드 + face-detection을 동적 import → 별도 청크(초기 번들 미포함).
 */
export async function loadFaceDetector(): Promise<FaceDetectorLike | null> {
  if (typeof document === 'undefined') return null;
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const tf = await import('@tensorflow/tfjs-core');
        await import('@tensorflow/tfjs-converter');
        await import('@tensorflow/tfjs-backend-webgl');
        await tf.setBackend('webgl').catch(() => {});
        await tf.ready();
        const fd = await import('@tensorflow-models/face-detection');
        const detector = await fd.createDetector(fd.SupportedModels.MediaPipeFaceDetector, {
          runtime: 'tfjs',
          modelType: 'short',
          maxFaces: 5,
        });
        return detector as unknown as FaceDetectorLike;
      } catch {
        return null; // 네트워크/WebGL/모델 로드 실패 → Tier A 유지
      }
    })();
  }
  return detectorPromise;
}

/**
 * 얼굴 박스들 → 신호(0~1). 가장 큰 얼굴의 면적비(우대) + 중앙성 결합.
 * 순수 함수(테스트 가능). 얼굴 없음/무효 → 0.
 */
export function faceSignal(faces: RawFaceBox[], frameW: number, frameH: number): number {
  if (!faces.length || frameW <= 0 || frameH <= 0) return 0;
  let best = 0;
  for (const f of faces) {
    const area = (f.width * f.height) / (frameW * frameH);
    const cx = (f.x + f.width / 2) / frameW;
    const cy = (f.y + f.height / 2) / frameH;
    // 중앙(0.5,0.5)에서 멀수록 감점 (대각 최대거리 ≈0.707로 정규화)
    const centrality = 1 - Math.min(1, Math.hypot(cx - 0.5, cy - 0.5) / 0.707);
    const areaScore = 1 - Math.exp(-area * 25); // area 0.05→0.71, 0.1→0.92
    const s = 0.7 * areaScore + 0.3 * centrality;
    if (s > best) best = s;
  }
  return clamp01(best);
}

/** 단일 프레임 얼굴 신호. 추론 실패 → 0. */
export async function detectFrameFace(
  detector: FaceDetectorLike,
  image: ImageData,
): Promise<number> {
  try {
    const faces = await detector.estimateFaces(image, { flipHorizontal: false });
    const boxes: RawFaceBox[] = faces.map((f) => ({
      x: f.box.xMin,
      y: f.box.yMin,
      width: f.box.width,
      height: f.box.height,
    }));
    return faceSignal(boxes, image.width, image.height);
  } catch {
    return 0;
  }
}
