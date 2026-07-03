/**
 * 자막 스타일 어시(Tier 2) 프레임 분석 — 순수 함수.
 *
 * 브라우저 canvas가 뽑은 프레임 픽셀(RgbaImage)에서 자막 영역의 밝기·대비·주색과
 * 상/하단 디테일밀도(피사체쏠림 프록시)를 계산한다. DOM 의존 없음(테스트 가능).
 * 참조: docs/02-design/features/caption-style-assist-tier2.design.md §4.1, §10.1
 */

export type CaptionBand = 'top' | 'bottom';

/** ImageData 구조 호환 최소 타입 (테스트에서 plain object로 생성 가능). */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

/** 한 프레임의 자막 밴드 + 상/하단 디테일 통계. 값은 전부 0~1. */
export interface RegionStats {
  /** 자막 밴드 평균 밝기 (perceptual luma) */
  bandLuma: number;
  /** 자막 밴드 밝기 표준편차 (대비/복잡도) */
  bandContrast: number;
  /** 자막 밴드 대표색 #RRGGBB (coarse 히스토그램 최빈 버킷) */
  bandDominant: string;
  /** 상단 1/3 디테일밀도(가로 인접 luma 차 평균) */
  topDetail: number;
  /** 하단 1/3 디테일밀도 */
  bottomDetail: number;
}

/** 여러 프레임 집계 → 추천에 쓰는 안정 신호. 샘플 0장이면 aggregate가 null 반환. */
export interface FrameSignals {
  sampleCount: number;
  band: CaptionBand;
  bandLuma: number;
  bandContrast: number;
  bandDominant: string;
  /** bandLuma>BRIGHT_LUMA 프레임 비율 */
  brightBandRatio: number;
  /** bandContrast>BUSY_CONTRAST 프레임 비율 */
  busyBandRatio: number;
  /** bottomDetail>topDetail*DETAIL_DOMINANCE 프레임 비율 */
  bottomHeavyRatio: number;
  /** topDetail>bottomDetail*DETAIL_DOMINANCE 프레임 비율 */
  topHeavyRatio: number;
}

// ── 명명 상수 (Design §10.1 — 테스트 결정론화) ──────────────────────────
export const BRIGHT_LUMA = 0.65;
export const BRIGHT_BAND_RATIO_MIN = 0.5;
export const BUSY_CONTRAST = 0.22;
export const BUSY_BAND_RATIO_MIN = 0.5;
export const DETAIL_DOMINANCE = 1.3;
export const DETAIL_HEAVY_RATIO_MIN = 0.6;
export const LOWCONTRAST_LUMA_DIFF = 0.25;
// Tier 2.1 외곽선 보정: 박스(busy≥0.5) 미만이지만 어느 정도 복잡한 배경 구간
export const MILD_BUSY_RATIO_MIN = 0.3;
export const OUTLINE_STRONG = 3.5;

/** perceptual luma 0~1 (R/G/B 0~255 입력). */
function lumaAt(data: RgbaImage['data'], idx: number): number {
  const r = data[idx]! / 255;
  const g = data[idx + 1]! / 255;
  const b = data[idx + 2]! / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** #RRGGBB의 luma 0~1. 파싱 실패 시 0. */
export function lumaOfHex(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 행 구간 [rowStart,rowEnd)의 가로 인접 픽셀 luma 차 절대값 평균 (0~1). */
function horizontalDetail(img: RgbaImage, rowStart: number, rowEnd: number): number {
  const { data, width } = img;
  if (width < 2 || rowEnd <= rowStart) return 0;
  let sum = 0;
  let count = 0;
  for (let y = rowStart; y < rowEnd; y++) {
    const rowBase = y * width * 4;
    let prev = lumaAt(data, rowBase);
    for (let x = 1; x < width; x++) {
      const cur = lumaAt(data, rowBase + x * 4);
      sum += Math.abs(cur - prev);
      prev = cur;
      count++;
    }
  }
  return count ? sum / count : 0;
}

/**
 * 프레임 픽셀 → RegionStats.
 * band(top|bottom)에 해당하는 세로 1/3 영역을 자막 밴드로 분석하고,
 * 상/하단 1/3의 디테일밀도를 각각 계산한다.
 */
export function analyzeFrameRegion(img: RgbaImage, band: CaptionBand): RegionStats {
  const { data, width, height } = img;
  const third = Math.max(1, Math.floor(height / 3));
  const topRange: [number, number] = [0, third];
  const bottomRange: [number, number] = [height - third, height];
  const bandRange = band === 'top' ? topRange : bottomRange;

  // 밴드 luma 평균·표준편차 + coarse 색 히스토그램
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  const hist = new Map<number, number>();
  for (let y = bandRange[0]; y < bandRange[1]; y++) {
    const rowBase = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowBase + x * 4;
      const l = lumaAt(data, idx);
      sum += l;
      sumSq += l * l;
      n++;
      // 채널당 3비트(8단계) 양자화 버킷
      const rq = data[idx]! >> 5;
      const gq = data[idx + 1]! >> 5;
      const bq = data[idx + 2]! >> 5;
      const key = (rq << 6) | (gq << 3) | bq;
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
  }

  const bandLuma = n ? sum / n : 0;
  const variance = n ? Math.max(0, sumSq / n - bandLuma * bandLuma) : 0;
  const bandContrast = Math.sqrt(variance);

  // 최빈 버킷 → 대표색(버킷 중심값)
  let bestKey = 0;
  let bestCount = -1;
  for (const [key, c] of hist) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = key;
    }
  }
  const toChannel = (q: number): number => Math.min(255, q * 32 + 16);
  const dr = toChannel((bestKey >> 6) & 0x7);
  const dg = toChannel((bestKey >> 3) & 0x7);
  const db = toChannel(bestKey & 0x7);
  const bandDominant =
    '#' + [dr, dg, db].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  return {
    bandLuma,
    bandContrast,
    bandDominant,
    topDetail: horizontalDetail(img, topRange[0], topRange[1]),
    bottomDetail: horizontalDetail(img, bottomRange[0], bottomRange[1]),
  };
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
}

/** RegionStats 배열 집계. 샘플 0장이면 null(호출부에서 Tier 1 강등). */
export function aggregateFrameSignals(
  stats: RegionStats[],
  band: CaptionBand,
): FrameSignals | null {
  if (stats.length === 0) return null;
  const n = stats.length;

  // 대표색 최빈값
  const domHist = new Map<string, number>();
  for (const s of stats) domHist.set(s.bandDominant, (domHist.get(s.bandDominant) ?? 0) + 1);
  let bandDominant = stats[0]!.bandDominant;
  let best = -1;
  for (const [color, c] of domHist) {
    if (c > best) {
      best = c;
      bandDominant = color;
    }
  }

  const ratio = (pred: (s: RegionStats) => boolean): number =>
    stats.filter(pred).length / n;

  return {
    sampleCount: n,
    band,
    bandLuma: mean(stats.map((s) => s.bandLuma)),
    bandContrast: mean(stats.map((s) => s.bandContrast)),
    bandDominant,
    brightBandRatio: ratio((s) => s.bandLuma > BRIGHT_LUMA),
    busyBandRatio: ratio((s) => s.bandContrast > BUSY_CONTRAST),
    bottomHeavyRatio: ratio((s) => s.bottomDetail > s.topDetail * DETAIL_DOMINANCE),
    topHeavyRatio: ratio((s) => s.topDetail > s.bottomDetail * DETAIL_DOMINANCE),
  };
}
