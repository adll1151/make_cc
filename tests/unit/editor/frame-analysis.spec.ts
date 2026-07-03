import { describe, it, expect } from 'vitest';
import {
  analyzeFrameRegion,
  aggregateFrameSignals,
  lumaOfHex,
  BRIGHT_LUMA,
  type RgbaImage,
  type RegionStats,
} from '@/features/editor/lib/frame-analysis';

/** (x,y) → [r,g,b] 콜백으로 RgbaImage 생성. */
function img(w: number, h: number, px: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = px(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const stat = (p: Partial<RegionStats>): RegionStats => ({
  bandLuma: 0,
  bandContrast: 0,
  bandDominant: '#000000',
  topDetail: 0,
  bottomDetail: 0,
  ...p,
});

describe('lumaOfHex', () => {
  it('흰색=1, 검정=0, 잘못된 입력=0', () => {
    expect(lumaOfHex('#FFFFFF')).toBeCloseTo(1);
    expect(lumaOfHex('#000000')).toBe(0);
    expect(lumaOfHex('nope')).toBe(0);
  });
});

describe('analyzeFrameRegion', () => {
  it('어두운 밴드 → 낮은 bandLuma', () => {
    const s = analyzeFrameRegion(img(6, 9, () => [20, 20, 20]), 'bottom');
    expect(s.bandLuma).toBeLessThan(0.15);
    expect(s.bandLuma).toBeLessThan(BRIGHT_LUMA);
  });

  it('밝은 밴드 → 높은 bandLuma(>BRIGHT_LUMA)', () => {
    const s = analyzeFrameRegion(img(6, 9, () => [230, 230, 230]), 'bottom');
    expect(s.bandLuma).toBeGreaterThan(BRIGHT_LUMA);
  });

  it('교차 컬럼(복잡) → 높은 대비·디테일', () => {
    const s = analyzeFrameRegion(
      img(6, 9, (x) => (x % 2 ? [255, 255, 255] : [0, 0, 0])),
      'bottom',
    );
    expect(s.bandContrast).toBeGreaterThan(0.22);
    expect(s.bottomDetail).toBeGreaterThan(0.5);
  });

  it('대표색: 빨강 밴드 → R 채널 우세', () => {
    const s = analyzeFrameRegion(img(6, 9, () => [255, 0, 0]), 'bottom');
    expect(s.bandDominant).toMatch(/^#F0/);
  });

  it('상단만 복잡·하단 단색 → topDetail ≫ bottomDetail', () => {
    const h = 9;
    const s = analyzeFrameRegion(
      img(6, h, (x, y) => {
        if (y < 3) return x % 2 ? [255, 255, 255] : [0, 0, 0]; // 상단 교차
        return [128, 128, 128]; // 하단 단색
      }),
      'bottom',
    );
    expect(s.topDetail).toBeGreaterThan(s.bottomDetail * 1.3);
    expect(s.bottomDetail).toBeLessThan(0.05);
  });
});

describe('aggregateFrameSignals', () => {
  it('빈 배열 → null (Tier 1 강등)', () => {
    expect(aggregateFrameSignals([], 'bottom')).toBeNull();
  });

  it('밝은 프레임 비율·집계', () => {
    const fs = aggregateFrameSignals(
      [stat({ bandLuma: 0.8 }), stat({ bandLuma: 0.9 }), stat({ bandLuma: 0.2 })],
      'bottom',
    );
    expect(fs?.sampleCount).toBe(3);
    expect(fs?.brightBandRatio).toBeCloseTo(2 / 3);
    expect(fs?.band).toBe('bottom');
  });

  it('하단쏠림 비율', () => {
    const fs = aggregateFrameSignals(
      [
        stat({ topDetail: 0.1, bottomDetail: 0.5 }), // 하단쏠림
        stat({ topDetail: 0.1, bottomDetail: 0.5 }),
        stat({ topDetail: 0.5, bottomDetail: 0.1 }), // 상단쏠림
      ],
      'bottom',
    );
    expect(fs?.bottomHeavyRatio).toBeCloseTo(2 / 3);
    expect(fs?.topHeavyRatio).toBeCloseTo(1 / 3);
  });

  it('대표색 최빈값', () => {
    const fs = aggregateFrameSignals(
      [stat({ bandDominant: '#FF0000' }), stat({ bandDominant: '#FF0000' }), stat({ bandDominant: '#00FF00' })],
      'bottom',
    );
    expect(fs?.bandDominant).toBe('#FF0000');
  });
});
