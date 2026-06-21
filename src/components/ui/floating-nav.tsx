'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DiscordInviteLink } from '@/components/DiscordInviteLink';
import { createBrowserSupabase } from '@/lib/supabase/browser';

/**
 * 2026 트렌드 — 상단 중앙에 떠 있는 pill nav.
 * 로그인 시 이메일+아바타 칩을 노출(상태 명확), 비로그인 시 "로그인" 버튼.
 */
export function FloatingNav() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav className="fixed left-1/2 top-6 z-50 -translate-x-1/2 enter-fade-up">
      <div className="glass-strong flex items-center gap-1 rounded-full px-2 py-1.5 shadow-[var(--shadow-card)]">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-white/5"
        >
          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold lowercase text-background">
            cc
          </span>
          <span>make_cc</span>
        </Link>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        <Link
          href="/upload"
          className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
        >
          업로드
        </Link>
        <Link
          href="/jobs"
          className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
        >
          내 이력
        </Link>
        <DiscordInviteLink className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground" />

        {email ? (
          <Link
            href="/account"
            title={`${email} · 계정`}
            className="ml-1 flex items-center gap-2 rounded-full border border-border/60 bg-white/5 py-1 pl-1 pr-3 transition hover:bg-white/10"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--aurora-purple)] to-[var(--aurora-magenta)] text-[11px] font-bold uppercase text-white">
              {email[0]}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
              {email}
            </span>
          </Link>
        ) : (
          <Button asChild variant="default" size="sm" className="ml-1 rounded-full">
            <Link href="/login">로그인</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
