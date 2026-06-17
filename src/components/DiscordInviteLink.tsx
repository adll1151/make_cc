import Link from 'next/link';
import { DiscordIcon } from './discord-icon';

/**
 * Discord 서버 초대 링크 (로고 아이콘). `NEXT_PUBLIC_DISCORD_INVITE_URL` 미설정 시 미렌더.
 * NEXT_PUBLIC env는 빌드 시 인라인 — 서버/클라이언트 어디서나 사용 가능.
 */
export function DiscordInviteLink({ className }: { className?: string }) {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;
  if (!invite) return null;
  return (
    <Link
      href={invite}
      target="_blank"
      rel="noreferrer"
      aria-label="Discord 서버 참여"
      className={['inline-flex items-center gap-1.5', className].filter(Boolean).join(' ')}
    >
      <DiscordIcon className="h-[18px] w-[18px]" />
      <span>Discord</span>
    </Link>
  );
}
