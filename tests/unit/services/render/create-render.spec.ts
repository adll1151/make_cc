import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from '@/types/job';
import type { RenderOptions } from '@/types/caption-style';

/**
 * createRender 오케스트레이션 — 소유검증 → 게이팅 → insert + enqueue.
 * Supabase admin / auth / jobs / queue / storage는 mock.
 * 핵심: insert 페이로드가 is_pro 게이팅을 반영하고, enqueueRender가 호출된다.
 */

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));

const h = vi.hoisted(() => {
  const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve(h.insertResult) }) }));
  const select = vi.fn(() => ({ eq: () => ({ maybeSingle: () => Promise.resolve(h.selectResult) }) }));
  return {
    insert,
    select,
    insertResult: { data: { id: 'r1' }, error: null } as { data: { id: string } | null; error: { message: string } | null },
    selectResult: { data: null, error: null } as { data: unknown; error: unknown },
    from: vi.fn(() => ({ insert, select })),
  };
});

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: h.from }) }));
vi.mock('@/services/auth', () => ({ getOwnerContext: vi.fn() }));
vi.mock('@/services/auth/user-profile', () => ({ readIsPro: vi.fn() }));
vi.mock('@/services/jobs', () => ({ getJobAdmin: vi.fn() }));
vi.mock('@/services/queue', () => ({ enqueueRender: vi.fn() }));
vi.mock('@/services/storage', () => ({ presignRenderDownload: vi.fn() }));

import { createRender } from '@/services/render/service';
import { getOwnerContext } from '@/services/auth';
import { readIsPro } from '@/services/auth/user-profile';
import { getJobAdmin } from '@/services/jobs';
import { enqueueRender } from '@/services/queue';
import { AppError } from '@/lib/api';

function finishedJob(over: Partial<Job> = {}): Job {
  return {
    id: 'job1',
    ownerType: 'user',
    ownerId: 'u1',
    userId: 'u1',
    status: 'finished',
    progressPercent: 100,
    queuePosition: null,
    videoOriginalName: 'clip.mp4',
    videoSizeBytes: 1000,
    videoDurationSec: 60,
    videoStorageKey: 'k',
    subtitleStorageKey: 's',
    language: 'ko',
    errorCode: null,
    errorMessage: null,
    speakerMap: {},
    diarizationEnabled: true,
    soundEventsEnabled: true,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    videoDeleteAt: null,
    ...over,
  };
}

const OPTS: RenderOptions = {
  aspect: '9:16',
  resolution: 1080,
  style: {
    template: 'basic',
    fontFamily: 'Pretendard',
    fontSizePct: 5,
    color: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 2,
    position: 'bottom',
    box: false,
    karaoke: false,
    karaokeColor: '#FFCC00',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.insertResult = { data: { id: 'r1' }, error: null };
  vi.mocked(enqueueRender).mockResolvedValue(true);
});

describe('createRender 게이팅 + 인입', () => {
  it('무료 회원: 1080 요청 → insert에 720 + watermark=true, enqueue 호출', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'u1', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(finishedJob());
    vi.mocked(readIsPro).mockResolvedValue(false);

    const out = await createRender('job1', OPTS);

    expect(out).toEqual({ renderId: 'r1' });
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: 'job1',
        user_id: 'u1',
        status: 'pending',
        aspect: '9:16',
        resolution: 720,
        watermark: true,
      }),
    );
    expect(enqueueRender).toHaveBeenCalledWith({ renderId: 'r1' });
  });

  it('Pro 회원: 1080 요청 → insert에 1080 + watermark=false', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'u1', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(finishedJob());
    vi.mocked(readIsPro).mockResolvedValue(true);

    await createRender('job1', OPTS);

    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: 1080, watermark: false }),
    );
  });

  it('게스트: is_pro 조회 없이 720 + watermark, user_id=null', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'guest', anonymousId: 'anon1' });
    vi.mocked(getJobAdmin).mockResolvedValue(
      finishedJob({ ownerType: 'guest', ownerId: 'anon1', userId: null }),
    );

    await createRender('job1', OPTS);

    expect(readIsPro).not.toHaveBeenCalled();
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, resolution: 720, watermark: true }),
    );
  });

  it('잡 없음 → NOT_FOUND, insert/enqueue 미호출', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'u1', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(null);

    await expect(createRender('job1', OPTS)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.insert).not.toHaveBeenCalled();
    expect(enqueueRender).not.toHaveBeenCalled();
  });

  it('타인 잡 → FORBIDDEN', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'other', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(finishedJob({ userId: 'u1' }));

    await expect(createRender('job1', OPTS)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('finished 아님 → INVALID_INPUT', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'u1', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(finishedJob({ status: 'transcribing' }));

    await expect(createRender('job1', OPTS)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(h.insert).not.toHaveBeenCalled();
  });

  it('insert 실패 → INTERNAL (AppError)', async () => {
    vi.mocked(getOwnerContext).mockResolvedValue({ kind: 'user', userId: 'u1', email: 'a@b.c' });
    vi.mocked(getJobAdmin).mockResolvedValue(finishedJob());
    vi.mocked(readIsPro).mockResolvedValue(false);
    h.insertResult = { data: null, error: { message: 'db down' } };

    await expect(createRender('job1', OPTS)).rejects.toBeInstanceOf(AppError);
    expect(enqueueRender).not.toHaveBeenCalled();
  });
});
