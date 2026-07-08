import { describe, it, expect } from 'vitest';
import {
  analyzeThumbFrame,
  scoreTierA,
  combineScore,
  type ThumbFrameSignals,
} from '@/features/editor/lib/thumbnail-score';
import type { RgbaImage } from '@/features/editor/lib/frame-analysis';

/** (x,y) → [r,g,b] 로 RGBA 이미지 생성 (alpha 255). */
function makeImage(
  width: number,
  height: number,
  fn: (x: number, y: number) => [number, number, number],
): RgbaImage {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      data.push(r, g, b, 255);
    }
  }
  return { data, width, height };
}

const W = 16;
const H = 16;
const grayMid = makeImage(W, H, () => [128, 128, 128]);
const dark = makeImage(W, H, () => [10, 10, 10]);
const checker = makeImage(W, H, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
const colorful = makeImage(W, H, (x) => (x % 2 ? [255, 0, 0] : [0, 0, 255]));
// 상단 2/3 색·디테일, 하단 1/3 평탄 → 하단 번잡 낮음
const calmBottom = makeImage(W, H, (x, y) =>
  y < Math.floor((H * 2) / 3) ? (x % 2 ? [230, 40, 40] : [30, 30, 220]) : [120, 120, 120],
);
// 하단 1/3만 번잡한 체커
const busyBottom = makeImage(W, H, (x, y) =>
  y >= H - Math.floor(H / 3) ? ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]) : [128, 128, 128],
);

describe('analyzeThumbFrame — 신호 산출', () => {
  it('모든 신호는 0~1 범위', () => {
    for (const img of [grayMid, dark, checker, colorful, calmBottom, busyBottom]) {
      const s = analyzeThumbFrame(img);
      for (const v of Object.values(s) as number[]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('선명도: 체커(엣지多) > 평탄 회색', () => {
    expect(analyzeThumbFrame(checker).sharpness).toBeGreaterThan(
      analyzeThumbFrame(grayMid).sharpness,
    );
  });

  it('색감: 원색 교차 > 무채색 회색', () => {
    expect(analyzeThumbFrame(colorful).colorfulness).toBeGreaterThan(
      analyzeThumbFrame(grayMid).colorfulness,
    );
  });

  it('밝기 적정도: 중간 회색 > 과암(어두운)', () => {
    expect(analyzeThumbFrame(grayMid).brightness).toBeGreaterThan(
      analyzeThumbFrame(dark).brightness,
    );
  });

  it('하단 복잡도: 하단 체커 > 평탄 회색', () => {
    expect(analyzeThumbFrame(busyBottom).lowerThirdBusy).toBeGreaterThan(
      analyzeThumbFrame(grayMid).lowerThirdBusy,
    );
  });

  it('너무 작은 이미지(<3px)는 전부 0', () => {
    const tiny = makeImage(2, 2, () => [200, 100, 50]);
    expect(analyzeThumbFrame(tiny)).toEqual<ThumbFrameSignals>({
      sharpness: 0,
      brightness: 0,
      colorfulness: 0,
      lowerThirdBusy: 0,
    });
  });

  it('결정론적 — 동일 입력 동일 출력', () => {
    expect(analyzeThumbFrame(colorful)).toEqual(analyzeThumbFrame(colorful));
  });
});

describe('scoreTierA — 결합 점수', () => {
  it('점수는 0~1로 clamp', () => {
    for (const img of [grayMid, dark, checker, colorful, calmBottom, busyBottom]) {
      const score = scoreTierA(analyzeThumbFrame(img));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('선명·유채색·차분한 하단 프레임 > 어둡고 평탄한 프레임', () => {
    expect(scoreTierA(analyzeThumbFrame(calmBottom))).toBeGreaterThan(
      scoreTierA(analyzeThumbFrame(dark)),
    );
  });

  it('하단 번잡 penalty — 동일 상단이면 번잡 하단이 감점', () => {
    const s = analyzeThumbFrame(busyBottom);
    const withoutPenalty = 0.5 * s.sharpness + 0.25 * s.brightness + 0.25 * s.colorfulness;
    expect(scoreTierA(s)).toBeLessThan(withoutPenalty);
  });
});

describe('combineScore — Tier A/B 통합', () => {
  const sig = analyzeThumbFrame(checker);

  it('aesthetic·face 없으면 scoreTierA와 동일', () => {
    expect(combineScore(sig)).toBe(scoreTierA(sig));
  });

  it('높은 face 신호는 점수를 올린다(낮은 베이스 기준)', () => {
    const base = analyzeThumbFrame(grayMid); // 낮은 베이스
    expect(combineScore({ ...base, face: 0.9 })).toBeGreaterThan(combineScore(base));
  });

  it('결과 0~1 clamp', () => {
    const s = combineScore({ ...sig, face: 1, aesthetic: 1 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
