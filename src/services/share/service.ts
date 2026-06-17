import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/api';
import type { ShareLink } from '@/types/share';

/**
 * 공유 링크 서비스.
 *
 * 권한 모델:
 *   - 모든 호출자는 라우트 레벨에서 owner 검증 후 호출 (이 서비스는 admin 사용)
 *   - 토큰 자체가 인증 역할인 공개 경로(/s/{token})는 getShareByToken만 호출
 *
 * 정책:
 *   - 회원만 생성 (route에서 강제)
 *   - 토큰 32자 URL-safe (base64url)
 *   - 만료 없음 (영구) — Plan §2.1
 *   - 폐기는 revoked_at 설정 (soft delete)
 */

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function createShareLink(params: { jobId: string }): Promise<ShareLink> {
  const admin = createAdminClient();

  // 이미 활성 토큰이 있으면 재사용 (idempotent)
  const { data: existing } = await admin
    .from('share_links')
    .select('*')
    .eq('job_id', params.jobId)
    .is('revoked_at', null)
    .maybeSingle();
  if (existing) return rowToShareLink(existing);

  const token = generateToken();
  const { data, error } = await admin
    .from('share_links')
    .insert({ job_id: params.jobId, token })
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('FORBIDDEN', '이 잡에는 이미 공유 링크가 있습니다.');
    }
    throw new Error(`공유 링크 생성 실패: ${error?.message ?? 'unknown'}`);
  }
  return rowToShareLink(data);
}

/**
 * 공유 페이지가 호출 (anonymous). token이 인증 역할.
 */
export async function getShareByToken(token: string): Promise<ShareLink | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error(`공유 링크 조회 실패: ${error.message}`);
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return rowToShareLink(data);
}

/** 히트 카운터 — 카운트는 soft (race 허용) */
export async function incrementShareHit(token: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('share_links')
    .select('hits')
    .eq('token', token)
    .maybeSingle();
  if (!row) return;
  await admin
    .from('share_links')
    .update({ hits: (row.hits ?? 0) + 1 })
    .eq('token', token);
}

/** 토큰 폐기 — 호출자가 권한 검증해야 함 */
export async function revokeShareLink(params: { token: string }): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', params.token)
    .is('revoked_at', null);
  if (error) throw new Error(`공유 링크 폐기 실패: ${error.message}`);
}

/** 잡별 활성 토큰 조회 — 호출자가 권한 검증 */
export async function getShareLinkByJobId(jobId: string): Promise<ShareLink | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('share_links')
    .select('*')
    .eq('job_id', jobId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new Error(`공유 링크 조회 실패: ${error.message}`);
  return data ? rowToShareLink(data) : null;
}

type ShareLinkRow = {
  id: string;
  job_id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  hits: number;
};

function rowToShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    jobId: row.job_id,
    token: row.token,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    hits: row.hits,
  };
}
