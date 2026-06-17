'use client';

import { useEffect, useState, useTransition } from 'react';
import { getDiscordState, linkDiscord, unlinkDiscord } from '@/services/auth/discord';
import type { NotifyChannel } from '@/types/user';
import { DiscordIcon } from '@/components/discord-icon';
import { NotifyChannelToggle } from './NotifyChannelToggle';

interface State {
  linked: boolean;
  discordUsername: string | null;
  notifyChannel: NotifyChannel;
  dmBlocked: boolean;
}

/**
 * 마이페이지 Discord 연결 섹션 — 연결/미연결/DM차단 3분기.
 * 상태는 server action(getDiscordState)으로 마운트 시 로드.
 */
export function DiscordLinkSection() {
  const [state, setState] = useState<State | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const s = await getDiscordState();
    if (s) {
      setState({
        linked: s.linked,
        discordUsername: s.discordUsername,
        notifyChannel: s.notifyChannel,
        dmBlocked: s.dmBlocked,
      });
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  function onConnect() {
    setErr(null);
    start(async () => {
      const r = await linkDiscord();
      if ('url' in r) window.location.href = r.url;
      else setErr(r.error);
    });
  }

  function onDisconnect() {
    setErr(null);
    start(async () => {
      const r = await unlinkDiscord();
      if ('error' in r) setErr(r.error);
      else await refresh();
    });
  }

  if (!state) return null; // 로딩

  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

  return (
    <div className="bento p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight">Discord 알림</h3>
        {state.linked && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={pending}
            className="text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-60"
          >
            연결 해제
          </button>
        )}
      </div>

      {!state.linked ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            잡 완료·실패 알림을 Discord DM으로 받아보세요.
            {invite && (
              <>
                {' '}
                먼저{' '}
                <a
                  href={invite}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  make_cc 서버
                </a>
                에 참여해야 봇이 DM을 보낼 수 있어요.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onConnect}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <DiscordIcon className="h-4 w-4" />
            {pending ? '연결 중…' : 'Discord 계정 연결'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm">
            ✅ 연결됨{' '}
            {state.discordUsername && (
              <span className="font-mono text-muted-foreground">@{state.discordUsername}</span>
            )}
          </p>
          {state.dmBlocked && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              DM이 차단된 것 같아요. Discord 개인정보 설정에서 “서버 멤버의 다이렉트 메시지 허용”을 켜주세요.
            </p>
          )}
          <NotifyChannelToggle
            value={state.notifyChannel}
            onChanged={(c) => setState((s) => (s ? { ...s, notifyChannel: c } : s))}
          />
        </>
      )}

      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}
