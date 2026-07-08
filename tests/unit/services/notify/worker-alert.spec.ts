import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 운영 알림(기동/복구/처리오류) 단위 테스트 — 게이팅 + 메시지 분기.
 * fetch stub, env/logger/supabase/storage mock.
 */

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { DISCORD_WORKER_ALERT_WEBHOOK: '', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv }));
vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/storage', () => ({ getWorkerHeartbeatTs: async () => null }));

import {
  alertWorkerOnline,
  alertJobFailed,
  isWorkerAlertEnabled,
} from '@/services/notify/worker-alert';

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function lastBody(): { content: string } {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
  return JSON.parse((call[1] as { body: string }).body);
}

describe('worker-alert 운영 알림', () => {
  beforeEach(() => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = '';
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  it('웹훅 미설정 → 비활성·발송 안 함', async () => {
    expect(isWorkerAlertEnabled()).toBe(false);
    await alertWorkerOnline({ backlogCount: 3, prevHeartbeatTs: null });
    await alertJobFailed({ jobId: 'j1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('기동 완료 — 적체 없음·최근 하트비트', async () => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = 'https://discord/webhook';
    await alertWorkerOnline({ backlogCount: 0, prevHeartbeatTs: Date.now() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastBody().content).toContain('기동 완료');
  });

  it('복구 — 하트비트 stale + 적체 N건', async () => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = 'https://discord/webhook';
    await alertWorkerOnline({ backlogCount: 5, prevHeartbeatTs: Date.now() - 5 * 60_000 });
    const c = lastBody().content;
    expect(c).toContain('복구');
    expect(c).toContain('5건');
  });

  it('적체 있어도 하트비트 신선하면 기동(복구 아님)', async () => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = 'https://discord/webhook';
    await alertWorkerOnline({ backlogCount: 5, prevHeartbeatTs: Date.now() });
    expect(lastBody().content).toContain('기동 완료');
  });

  it('처리 오류 — 이름·사유·단계·짧은 id 포함', async () => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = 'https://discord/webhook';
    await alertJobFailed({
      jobId: 'abcd1234efgh',
      videoOriginalName: '회의록.mp4',
      errorCode: 'STT_FAILED',
      stage: 'STT',
    });
    const c = lastBody().content;
    expect(c).toContain('회의록.mp4');
    expect(c).toContain('STT_FAILED');
    expect(c).toContain('abcd1234');
    expect(c).toContain('STT 단계');
  });

  it('발송 실패해도 throw 안 함', async () => {
    mockEnv.DISCORD_WORKER_ALERT_WEBHOOK = 'https://discord/webhook';
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(alertJobFailed({ jobId: 'j1' })).resolves.toBeUndefined();
  });
});
