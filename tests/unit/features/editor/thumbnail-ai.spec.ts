import { describe, it, expect } from 'vitest';
import { faceSignal, type RawFaceBox } from '@/features/editor/lib/thumbnail-ai';

const box = (x: number, y: number, width: number, height: number): RawFaceBox => ({
  x,
  y,
  width,
  height,
});

describe('faceSignal — 얼굴 신호(0~1)', () => {
  it('얼굴 없음 → 0', () => {
    expect(faceSignal([], 100, 100)).toBe(0);
  });

  it('프레임 크기 0 → 0', () => {
    expect(faceSignal([box(0, 0, 10, 10)], 0, 0)).toBe(0);
  });

  it('중앙의 큰 얼굴 > 구석의 작은 얼굴', () => {
    const bigCentered = faceSignal([box(30, 20, 40, 60)], 100, 100);
    const smallCorner = faceSignal([box(0, 0, 8, 10)], 100, 100);
    expect(bigCentered).toBeGreaterThan(smallCorner);
  });

  it('같은 크기면 중앙이 구석보다 높음', () => {
    const center = faceSignal([box(35, 35, 30, 30)], 100, 100);
    const corner = faceSignal([box(0, 0, 30, 30)], 100, 100);
    expect(center).toBeGreaterThan(corner);
  });

  it('여러 얼굴이면 최고값 사용', () => {
    const faces = [box(0, 0, 6, 6), box(35, 35, 40, 40)];
    expect(faceSignal(faces, 100, 100)).toBe(faceSignal([box(35, 35, 40, 40)], 100, 100));
  });

  it('결과는 0~1 범위', () => {
    for (const b of [box(10, 10, 80, 80), box(0, 0, 5, 5), box(40, 40, 20, 20)]) {
      const s = faceSignal([b], 100, 100);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
