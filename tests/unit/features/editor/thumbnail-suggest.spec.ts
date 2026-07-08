import { describe, it, expect } from 'vitest';
import {
  rankCandidates,
  suggestThumbnails,
  type RankInputFrame,
} from '@/features/editor/lib/thumbnail-suggest';
import type { RgbaImage } from '@/features/editor/lib/frame-analysis';

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
const colorLR = makeImage(W, H, (x) => (x < W / 2 ? [230, 40, 40] : [40, 40, 220]));
const topBottom = makeImage(W, H, (_x, y) => (y < H / 2 ? [220, 220, 220] : [20, 20, 20]));
const darkCorner = makeImage(W, H, (x, y) => (x < 3 && y < 3 ? [220, 220, 220] : [15, 15, 15]));

/** 8칸 중 k번째 가로 밴드만 밝은 프레임 (서로 다른 해시). */
function bandFrame(k: number): RgbaImage {
  const lo = Math.floor((k * H) / 8);
  const hi = Math.floor(((k + 1) * H) / 8);
  return makeImage(W, H, (_x, y) => (y >= lo && y < hi ? [220, 220, 220] : [20, 20, 20]));
}

const frame = (timeMs: number, image: RgbaImage): RankInputFrame => ({
  timeMs,
  image,
  dataUrl: `data:img,${timeMs}`,
});

describe('rankCandidates — 채점·유사제거·랭킹', () => {
  it('빈 입력 → best null·빈 후보·tier A', () => {
    expect(rankCandidates([])).toEqual({ best: null, candidates: [], tier: 'A' });
  });

  it('점수 내림차순 정렬 + best=candidates[0]', () => {
    const res = rankCandidates([
      frame(1000, colorLR),
      frame(2000, topBottom),
      frame(3000, darkCorner),
    ]);
    expect(res.best).not.toBeNull();
    expect(res.best).toBe(res.candidates[0]);
    for (let i = 1; i < res.candidates.length; i++) {
      expect(res.candidates[i - 1]!.score).toBeGreaterThanOrEqual(res.candidates[i]!.score);
    }
    // best는 전체 최고 점수
    const maxScore = Math.max(...res.candidates.map((c) => c.score));
    expect(res.best!.score).toBe(maxScore);
  });

  it('동일 프레임(같은 해시)은 유사로 제거 — 고점 1개만 유지', () => {
    const res = rankCandidates([
      frame(1000, colorLR),
      frame(1500, colorLR), // 동일 → dedup
      frame(2000, topBottom),
    ]);
    expect(res.candidates).toHaveLength(2);
  });

  it('topN 상한 적용 (서로 다른 프레임 8개 → 5개)', () => {
    const frames = Array.from({ length: 8 }, (_, k) => frame(k * 1000, bandFrame(k)));
    const res = rankCandidates(frames, { dedupThreshold: 0 });
    expect(res.candidates).toHaveLength(5);
  });

  it('face/aesthetic 없으면 tier=A', () => {
    expect(rankCandidates([frame(0, colorLR)]).tier).toBe('A');
  });

  it('face 신호가 있으면 tier=AB', () => {
    expect(rankCandidates([{ ...frame(0, colorLR), face: 0.9 }]).tier).toBe('AB');
  });

  it('동일 베이스면 얼굴 있는 프레임이 best', () => {
    const withFace = { timeMs: 1000, image: topBottom, dataUrl: 'a', face: 0.9 };
    const noFace = { timeMs: 2000, image: topBottom, dataUrl: 'b', face: 0 };
    // dedupThreshold -1 → 동일 해시라도 제거 안 함(두 장 유지)
    const res = rankCandidates([noFace, withFace], { dedupThreshold: -1 });
    expect(res.best?.timeMs).toBe(1000);
  });
});

describe('suggestThumbnails — 비-DOM(node)에서 graceful', () => {
  it('DOM 없으면 추출 불가 → 빈 추천', async () => {
    const res = await suggestThumbnails('https://example.com/v.mp4');
    expect(res).toEqual({ best: null, candidates: [], tier: 'A' });
  });

  it('videoUrl null → 빈 추천', async () => {
    const res = await suggestThumbnails(null);
    expect(res.best).toBeNull();
  });
});
