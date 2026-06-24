'use client';

import { useState, useTransition } from 'react';
import { setNotifyChannel } from '@/services/auth/discord';
import type { NotifyChannel } from '@/types/user';

const OPTIONS: { value: NotifyChannel; label: string }[] = [
  { value: 'email', label: '이메일' },
  { value: 'discord', label: 'Discord DM' },
  { value: 'both', label: '둘 다' },
];

/** 알림 경로 라디오 — 낙관적 업데이트, 실패 시 롤백. */
export function NotifyChannelToggle({
  value,
  onChanged,
}: {
  value: NotifyChannel;
  onChanged: (c: NotifyChannel) => void;
}) {
  const [current, setCurrent] = useState<NotifyChannel>(value);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function choose(next: NotifyChannel) {
    if (next === current || pending) return;
    const prev = current;
    setCurrent(next);
    onChanged(next);
    setErr(null);
    start(async () => {
      const r = await setNotifyChannel(next);
      if ('error' in r) {
        setCurrent(prev);
        onChanged(prev);
        setErr(r.error);
      }
    });
  }

  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">알림 받을 곳</p>
      <div className="mt-2 flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={pending}
            aria-pressed={current === o.value}
            className={`rounded-full px-3 py-1.5 text-sm transition disabled:opacity-60 ${
              current === o.value
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}
