'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DiscordInviteLink } from '@/components/DiscordInviteLink';
import { createBrowserSupabase } from '@/lib/supabase/browser';

/**
 * 2026 트렌드 — 상단 중앙에 떠 있는 pill nav.
 * 로그인 상태를 반영해 "로그인" ↔ "계정" 전환 (로그아웃/로딩 시 기본 "로그인").
 */
export function FloatingNav() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setAuthed(!!session?.user),
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

        <Button asChild variant="default" size="sm" className="ml-1 rounded-full">
          {authed ? <Link href="/account">계정</Link> : <Link href="/login">로그인</Link>}
        </Button>
      </div>
    </nav>
  );
}
