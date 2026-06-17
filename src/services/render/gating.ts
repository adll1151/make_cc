import { FREE_MAX_RESOLUTION, type RenderOptions } from '@/types/caption-style';

/**
 * 렌더 게이팅 (pure) — 클라이언트가 보낸 해상도·워터마크를 신뢰하지 않고
 * `is_pro` 기준으로 재결정한다. 수익 누수 방지의 단일 진실(Design §4.2, §10).
 *
 *   - 무료(is_pro=false): 워터마크 강제(true) + 해상도 720p 강제
 *   - Pro(is_pro=true):   워터마크 제거(false) + 요청 해상도(≤1080) 허용
 *
 * 이 함수는 입력→출력 결정적 pure → 단위테스트로 게이팅을 고정한다.
 */

export const PRO_MAX_RESOLUTION = 1080 as const;

export interface GatedRenderConfig {
  resolution: number;
  watermark: boolean;
}

export function resolveRenderGating(
  opts: Pick<RenderOptions, 'resolution'>,
  isPro: boolean,
): GatedRenderConfig {
  if (!isPro) {
    return { resolution: FREE_MAX_RESOLUTION, watermark: true };
  }
  return {
    resolution: Math.min(opts.resolution, PRO_MAX_RESOLUTION),
    watermark: false,
  };
}
