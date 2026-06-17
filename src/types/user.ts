/**
 * 사용자 프로필 + 알림 경로 도메인 타입.
 * DB: supabase/migrations/20260616000001_user_profiles_discord.sql
 * 참조: docs/02-design/features/discord-integration.design.md §3.1
 *
 * snake_case(DB) ↔ camelCase(TS) 변환은 services/auth · services/notify에서 처리.
 */

/** 알림 수신 경로 */
export type NotifyChannel = 'email' | 'discord' | 'both';

export const NOTIFY_CHANNELS: readonly NotifyChannel[] = ['email', 'discord', 'both'] as const;

export interface UserProfile {
  userId: string;
  discordUserId: string | null;
  discordUsername: string | null;
  notifyChannel: NotifyChannel;
  discordDmBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * dispatcher가 알림 라우팅에 필요로 하는 최소 프로필 (admin/service_role 읽기).
 * 행이 없으면 email 기본값으로 채워진다.
 */
export interface NotifyProfile {
  notifyChannel: NotifyChannel;
  discordUserId: string | null;
  discordDmBlocked: boolean;
}

/** 채널 함수(sendEmail/sendDiscordDM) 공통 반환 */
export interface NotifyResult {
  channel: 'email' | 'discord';
  ok: boolean;
  reason?: NotifyFailReason;
}

export type NotifyFailReason =
  // discord
  | 'blocked' // 50007 — 사용자 privacy 차단
  | 'rate_limited' // 429 — 재시도 초과
  | 'not_linked' // discord 미연결
  // email (기존 service.ts 반환과 호환)
  | 'no-recipient' // 게스트/미인증
  | 'no-resend' // RESEND 미설정
  | 'send-failed' // 발송 예외
  // 공통
  | 'error';
