/**
 * 섬네일 추천 — Tier A 휴리스틱 채점 (순수 함수). Design §4 m2.
 *
 * 프레임 픽셀(RgbaImage)에서 선명도·밝기적정·색감·하단복잡도를 계산하고
 * 0..1 결합 점수를 낸다. DOM 의존 없음(테스트 가능). 모델(Tier B) 없이도 성립.
 */

import type { RgbaImage } from './frame-analysis';

/** 한 프레임의 Tier A 신호 (전부 0~1). */
export interface ThumbFrameSignals {
  /** 선명도 — Laplacian 평균 절대값의 saturating (흐릿할수록 낮음) */
  sharpness: number;
  /** 밝기 적정도 — 과암/과명 penalty (적정 노출 근처가 높음) */
  brightness: number;
  /** 색감 — Hasler-Süsstrunk colorfulness의 saturating */
  colorfulness: number;
  /** 하단 1/3 복잡도 — 인접 luma 차 밀도 (높을수록 자막/배경 번잡) */
  lowerThirdBusy: number;
}

// ── 결합 가중 (Design §4 m4 — Tier A 재정규화) ──────────────────────
export const W_SHARP = 0.5;
export const W_BRIGHT = 0.25;
export const W_COLOR = 0.25;
export const P_LOWER_BUSY = 0.15; // 하단 번잡 penalty
// saturating 상수 (신호 스케일 → 0..1 결정론화)
export const K_SHARP = 12;
export const K_COLOR = 1 / 60;
export const K_BUSY = 10;
export const BRIGHT_IDEAL = 0.52;
export const BRIGHT_SIGMA = 0.2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** perceptual luma 0~1 (R/G/B 0~255 입력). */
function lumaAt(data: RgbaImage['data'], idx: number): number {
  const r = data[idx]! / 255;
  const g = data[idx + 1]! / 255;
  const b = data[idx + 2]! / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 프레임 픽셀 → Tier A 신호.
 * - sharpness: 4-이웃 Laplacian 평균 절대값 → 1-exp(-K·v)
 * - brightness: 평균 luma의 이상치 gaussian (BRIGHT_IDEAL 근처=1)
 * - colorfulness: Hasler-Süsstrunk(rg/yb 평균·표준편차) → 1-exp(-C·K)
 * - lowerThirdBusy: 하단 1/3 가로 인접 luma 차 평균 → 1-exp(-K·d)
 */
export function analyzeThumbFrame(img: RgbaImage): ThumbFrameSignals {
  const { data, width, height } = img;
  if (width < 3 || height < 3) {
    return { sharpness: 0, brightness: 0, colorfulness: 0, lowerThirdBusy: 0 };
  }

  // 밝기 + 색감 (전체 픽셀 1패스)
  let sumLuma = 0;
  let sumRg = 0;
  let sumRgSq = 0;
  let sumYb = 0;
  let sumYbSq = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    const rowBase = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowBase + x * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      sumLuma += lumaAt(data, idx);
      const rg = r - g;
      const yb = 0.5 * (r + g) - b;
      sumRg += rg;
      sumRgSq += rg * rg;
      sumYb += yb;
      sumYbSq += yb * yb;
      n++;
    }
  }
  const meanLuma = sumLuma / n;
  const brightness = Math.exp(
    -((meanLuma - BRIGHT_IDEAL) ** 2) / (2 * BRIGHT_SIGMA * BRIGHT_SIGMA),
  );

  const meanRg = sumRg / n;
  const meanYb = sumYb / n;
  const stdRg = Math.sqrt(Math.max(0, sumRgSq / n - meanRg * meanRg));
  const stdYb = Math.sqrt(Math.max(0, sumYbSq / n - meanYb * meanYb));
  const colorMetric =
    Math.sqrt(stdRg * stdRg + stdYb * stdYb) +
    0.3 * Math.sqrt(meanRg * meanRg + meanYb * meanYb);
  const colorfulness = 1 - Math.exp(-colorMetric * K_COLOR);

  // 선명도 (내부 픽셀 Laplacian)
  let lapSum = 0;
  let lapN = 0;
  for (let y = 1; y < height - 1; y++) {
    const rowBase = y * width * 4;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowBase + x * 4;
      const c = lumaAt(data, idx);
      const l = lumaAt(data, idx - 4);
      const r = lumaAt(data, idx + 4);
      const u = lumaAt(data, idx - width * 4);
      const d = lumaAt(data, idx + width * 4);
      lapSum += Math.abs(4 * c - l - r - u - d);
      lapN++;
    }
  }
  const sharpness = lapN ? 1 - Math.exp(-K_SHARP * (lapSum / lapN)) : 0;

  // 하단 1/3 복잡도 (가로 인접 luma 차)
  const third = Math.max(1, Math.floor(height / 3));
  let busySum = 0;
  let busyN = 0;
  for (let y = height - third; y < height; y++) {
    const rowBase = y * width * 4;
    let prev = lumaAt(data, rowBase);
    for (let x = 1; x < width; x++) {
      const cur = lumaAt(data, rowBase + x * 4);
      busySum += Math.abs(cur - prev);
      prev = cur;
      busyN++;
    }
  }
  const lowerThirdBusy = busyN ? 1 - Math.exp(-K_BUSY * (busySum / busyN)) : 0;

  return { sharpness, brightness, colorfulness, lowerThirdBusy };
}

/** Tier A 결합 점수 (0~1). aesthetic·face 없이 성립. */
export function scoreTierA(s: ThumbFrameSignals): number {
  return clamp01(
    W_SHARP * s.sharpness +
      W_BRIGHT * s.brightness +
      W_COLOR * s.colorfulness -
      P_LOWER_BUSY * s.lowerThirdBusy,
  );
}
