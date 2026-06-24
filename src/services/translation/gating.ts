import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/api';

/**
 * 번역 게이팅 (subtitle-translation).
 *
 * 정책(Design §2): 무료 = 잡당 1언어, Pro = 무제한.
 *   - 같은 언어 재번역(idempotent/재시도)은 한도에 포함하지 않는다.
 *   - 서버(service)에서 강제 — 클라 신뢰 금지. 번인 게이팅(resolveRenderGating)과 동일 사상.
 */

export const FREE_MAX_LANGS_PER_JOB = 1;

/**
 * 번역 허용 여부 검사. 위반 시 AppError throw.
 * 무료 사용자가 이미 다른 언어 번역을 보유하면(실패 제외) 추가 차단.
 */
export async function assertTranslationAllowed(params: {
  jobId: string;
  targetLang: string;
  isPro: boolean;
}): Promise<void> {
  if (params.isPro) return;

  const admin = createAdminClient();
  // 같은 잡의 '다른 언어' 번역 중 실패가 아닌 것 개수
  const { count, error } = await admin
    .from('translations')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', params.jobId)
    .neq('target_lang', params.targetLang)
    .neq('status', 'failed');
  if (error) throw new AppError('INTERNAL', `번역 한도 확인 실패: ${error.message}`);

  if ((count ?? 0) >= FREE_MAX_LANGS_PER_JOB) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `무료 플랜은 영상당 ${FREE_MAX_LANGS_PER_JOB}개 언어까지 번역할 수 있어요. Pro로 업그레이드하면 모든 언어를 번역할 수 있습니다.`,
      { reason: 'TRANSLATION_LANG_LIMIT', limit: FREE_MAX_LANGS_PER_JOB },
    );
  }
}
