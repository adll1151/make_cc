'use client';

import type { RgbaImage } from './frame-analysis';
import {
  analyzeThumbFrame,
  scoreTierA,
  aHash,
  hammingDistance,
  type ThumbFrameSignals,
} from './thumbnail-score';
import { extractCandidateFrames, type ExtractOptions } from './thumbnail-extract';

/**
 * 섬네일 추천 오케스트레이터. Design §4 m4.
 *
 * 추출(DOM) → Tier A 채점 → 유사 프레임 제거 → 랭킹 → { best, candidates, tier }.
 * 채점·랭킹(rankCandidates)은 순수 함수로 분리(DOM 없이 테스트 가능).
 * Tier B(NIMA·BlazeFace)는 m3에서 signals.aesthetic/face 결합으로 확장 예정.
 */

export const DEFAULT_TOP_N = 5;
export const DEFAULT_DEDUP_THRESHOLD = 6; // aHash 해밍거리 ≤ → 유사로 간주

export interface ThumbCandidate {
  timeMs: number;
  /** 미리보기 data URL (다운스케일) */
  dataUrl: string;
  /** 0~1 결합 점수 */
  score: number;
  signals: ThumbFrameSignals & { aesthetic?: number; face?: number };
}

export interface ThumbSuggestion {
  best: ThumbCandidate | null;
  /** score 내림차순, best 포함, 유사 제거 후 최대 topN */
  candidates: ThumbCandidate[];
  /** 실제 적용된 티어 (현재 A. m3에서 AB) */
  tier: 'A' | 'AB';
}

export interface RankInputFrame {
  timeMs: number;
  image: RgbaImage;
  dataUrl: string;
}

export interface RankOptions {
  topN?: number;
  dedupThreshold?: number;
}

/** 순수 — 추출된 프레임을 채점·유사제거·랭킹. DOM 없음(테스트 가능). */
export function rankCandidates(frames: RankInputFrame[], opts: RankOptions = {}): ThumbSuggestion {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const dedupThreshold = opts.dedupThreshold ?? DEFAULT_DEDUP_THRESHOLD;
  if (frames.length === 0) return { best: null, candidates: [], tier: 'A' };

  const scored = frames.map((f) => {
    const signals = analyzeThumbFrame(f.image);
    return {
      timeMs: f.timeMs,
      dataUrl: f.dataUrl,
      score: scoreTierA(signals),
      signals,
      hash: aHash(f.image),
    };
  });
  // 점수 내림차순, 동점은 이른 시각 우선(결정론)
  scored.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);

  // 유사 프레임 제거 — 고점 우선 유지
  const kept: typeof scored = [];
  for (const c of scored) {
    if (kept.some((k) => hammingDistance(k.hash, c.hash) <= dedupThreshold)) continue;
    kept.push(c);
    if (kept.length >= topN) break;
  }

  const candidates: ThumbCandidate[] = kept.map((c) => ({
    timeMs: c.timeMs,
    dataUrl: c.dataUrl,
    score: c.score,
    signals: c.signals,
  }));
  return { best: candidates[0] ?? null, candidates, tier: 'A' };
}

/** DOM — videoUrl에서 후보 추출 후 랭킹. 실패 시 빈 추천. */
export async function suggestThumbnails(
  videoUrl: string | null | undefined,
  opts: ExtractOptions & RankOptions = {},
): Promise<ThumbSuggestion> {
  const frames = await extractCandidateFrames(videoUrl, opts);
  return rankCandidates(
    frames.map((f) => ({ timeMs: f.timeMs, image: f.image, dataUrl: f.previewDataUrl })),
    opts,
  );
}
