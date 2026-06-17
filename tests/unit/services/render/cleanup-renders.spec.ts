import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * cleanupExpiredRenders — 만료 렌더 출력 삭제 + output_storage_key null화.
 * Supabase admin / storage.deleteRender mock.
 */

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));

const h = vi.hoisted(() => {
  return {
    scanResult: { data: [] as Array<{ id: string; output_storage_key: string | null }>, error: null as { message: string } | null },
    updateResult: { error: null as { message: string } | null },
    update: vi.fn(() => ({ eq: () => Promise.resolve(h.updateResult) })),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        lt: () => ({ not: () => ({ limit: () => Promise.resolve(h.scanResult) }) }),
      }),
      update: h.update,
    }),
  }),
}));

vi.mock('@/services/storage', () => ({
  presignRenderDownload: vi.fn(),
  deleteRender: vi.fn(),
}));
// service.ts가 import하는 다른 service들 (createRender/getRender 경로) — cleanup 테스트엔 불필요하나 모듈 로드용 stub
vi.mock('@/services/auth', () => ({ getOwnerContext: vi.fn() }));
vi.mock('@/services/auth/user-profile', () => ({ readIsPro: vi.fn() }));
vi.mock('@/services/jobs', () => ({ getJobAdmin: vi.fn() }));
vi.mock('@/services/queue', () => ({ enqueueRender: vi.fn() }));

import { cleanupExpiredRenders } from '@/services/render/service';
import { deleteRender } from '@/services/storage';

beforeEach(() => {
  vi.clearAllMocks();
  h.scanResult = { data: [], error: null };
  h.updateResult = { error: null };
  vi.mocked(deleteRender).mockResolvedValue(undefined);
});

describe('cleanupExpiredRenders', () => {
  it('만료 렌더 2건 → 각각 삭제 + output_storage_key null화', async () => {
    h.scanResult = {
      data: [
        { id: 'r1', output_storage_key: '2026/06/r1/r1.mp4' },
        { id: 'r2', output_storage_key: '2026/06/r2/r2.mp4' },
      ],
      error: null,
    };

    const result = await cleanupExpiredRenders();

    expect(deleteRender).toHaveBeenCalledTimes(2);
    expect(deleteRender).toHaveBeenCalledWith('2026/06/r1/r1.mp4');
    expect(h.update).toHaveBeenCalledTimes(2);
    expect(h.update).toHaveBeenCalledWith({ output_storage_key: null });
    expect(result).toEqual({ scanned: 2, deleted: 2, errors: 0 });
  });

  it('만료 대상 없음 → 삭제 미호출', async () => {
    h.scanResult = { data: [], error: null };
    const result = await cleanupExpiredRenders();
    expect(deleteRender).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, deleted: 0, errors: 0 });
  });

  it('일부 삭제 실패 → errors 카운트, 나머지는 계속', async () => {
    h.scanResult = {
      data: [
        { id: 'r1', output_storage_key: 'k1' },
        { id: 'r2', output_storage_key: 'k2' },
      ],
      error: null,
    };
    vi.mocked(deleteRender).mockRejectedValueOnce(new Error('storage down'));

    const result = await cleanupExpiredRenders();

    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('scan 실패 → errors=1', async () => {
    h.scanResult = { data: [], error: { message: 'db error' } };
    const result = await cleanupExpiredRenders();
    expect(result).toEqual({ scanned: 0, deleted: 0, errors: 1 });
    expect(deleteRender).not.toHaveBeenCalled();
  });
});
