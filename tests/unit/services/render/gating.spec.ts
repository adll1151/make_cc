import { describe, it, expect } from 'vitest';
import { resolveRenderGating, PRO_MAX_RESOLUTION } from '@/services/render/gating';
import { FREE_MAX_RESOLUTION } from '@/types/caption-style';

/**
 * 게이팅(pure) — 클라가 보낸 resolution을 무시하고 is_pro로 재결정한다.
 * Design §4.2 / §7: 워터마크·해상도는 서버 강제(수익 누수 방지).
 */
describe('resolveRenderGating', () => {
  it('무료(isPro=false): 1080을 요청해도 720 + 워터마크 강제', () => {
    expect(resolveRenderGating({ resolution: 1080 }, false)).toEqual({
      resolution: FREE_MAX_RESOLUTION, // 720
      watermark: true,
    });
  });

  it('무료(isPro=false): 720 요청도 동일하게 720 + 워터마크', () => {
    expect(resolveRenderGating({ resolution: 720 }, false)).toEqual({
      resolution: 720,
      watermark: true,
    });
  });

  it('Pro(isPro=true): 1080 요청 → 1080 + 워터마크 제거', () => {
    expect(resolveRenderGating({ resolution: 1080 }, true)).toEqual({
      resolution: 1080,
      watermark: false,
    });
  });

  it('Pro(isPro=true): 720 요청 → 720 + 워터마크 제거', () => {
    expect(resolveRenderGating({ resolution: 720 }, true)).toEqual({
      resolution: 720,
      watermark: false,
    });
  });

  it('Pro(isPro=true): 1080 초과 요청은 1080으로 클램프', () => {
    // 타입상 720|1080이지만 방어적 상한을 검증
    expect(resolveRenderGating({ resolution: 4320 as 1080 }, true)).toEqual({
      resolution: PRO_MAX_RESOLUTION, // 1080
      watermark: false,
    });
  });

  it('무료가 항상 가장 보수적 — isPro만 워터마크 제거 권한을 가진다', () => {
    expect(resolveRenderGating({ resolution: 1080 }, false).watermark).toBe(true);
    expect(resolveRenderGating({ resolution: 1080 }, true).watermark).toBe(false);
  });
});
