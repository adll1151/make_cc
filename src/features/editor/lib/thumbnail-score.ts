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

// ── 결합 가중 (Design §4 m4) — 존재하는 양성 신호만 쓰고 합=1로 재정규화 ──
export const W = {
  aesthetic: 0.35, // Tier B (NIMA) — 미구현, signals.aesthetic 있을 때만
  face: 0.2, // Tier B (BlazeFace)
  sharp: 0.2,
  bright: 0.1,
  color: 0.1,
} as const;
export const P_LOWER_BUSY = 0.15; // 하단 번잡 penalty (항상 적용)
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

/** Tier A/B 통합 신호 — aesthetic·face는 있을 때만. */
export type CombinedSignals = ThumbFrameSignals & { aesthetic?: number; face?: number };

/**
 * 결합 점수 (0~1). 존재하는 양성 신호(sharp·bright·color + 있으면 aesthetic·face)의
 * 가중치만 합=1로 재정규화 → Tier B 부재 시에도 스케일 일관. lowerThirdBusy는 penalty.
 */
export function combineScore(s: CombinedSignals): number {
  const terms: Array<[number, number]> = [
    [W.sharp, s.sharpness],
    [W.bright, s.brightness],
    [W.color, s.colorfulness],
  ];
  if (s.aesthetic != null) terms.push([W.aesthetic, s.aesthetic]);
  if (s.face != null) terms.push([W.face, s.face]);
  const wsum = terms.reduce((a, [w]) => a + w, 0) || 1;
  const positive = terms.reduce((a, [w, v]) => a + w * v, 0) / wsum;
  return clamp01(positive - P_LOWER_BUSY * s.lowerThirdBusy);
}

/** Tier A 결합 점수 (0~1). aesthetic·face 없이 성립 (combineScore의 특수형). */
export function scoreTierA(s: ThumbFrameSignals): number {
  return combineScore(s);
}

/**
 * 평균 해시(aHash) — size×size 그리드 셀 평균 luma가 전체 평균보다 밝으면 1.
 * 유사 프레임(연속 seek의 거의 동일한 컷) 제거용 지문. Design §2 Q2.
 */
export function aHash(img: RgbaImage, size = 8): number[] {
  const { data, width, height } = img;
  if (width < 1 || height < 1) return new Array(size * size).fill(0);
  const cells: number[] = [];
  for (let gy = 0; gy < size; gy++) {
    const y0 = Math.floor((gy * height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / size));
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor((gx * width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / size));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        const rowBase = y * width * 4;
        for (let x = x0; x < x1 && x < width; x++) {
          sum += lumaAt(data, rowBase + x * 4);
          n++;
        }
      }
      cells.push(n ? sum / n : 0);
    }
  }
  const mean = cells.reduce((s, v) => s + v, 0) / (cells.length || 1);
  return cells.map((v) => (v > mean ? 1 : 0));
}

/** 두 해시의 해밍 거리 (다른 비트 수). 길이 다르면 초과분을 거리에 가산. */
export function hammingDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++;
  return d + Math.abs(a.length - b.length);
}
