'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Magnetic } from '@/components/motion/Magnetic';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DiscordInviteLink } from '@/components/DiscordInviteLink';
import { createBrowserSupabase } from '@/lib/supabase/browser';

/**
 * 2026 트렌드 — 상단 중앙에 떠 있는 pill nav.
 * 로그인 시 이메일+아바타 칩을 노출(상태 명확), 비로그인 시 "로그인" 버튼.
 */
export function FloatingNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // 스크롤 시 nav가 줄어들고 글로우가 강해진다(stuck 반응).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 enter-fade-up transition-all duration-500 ease-[var(--ease-out-expo)] ${
        scrolled ? 'top-3 scale-[0.96]' : ''
      }`}
    >
      <div
        className={`glass-strong flex items-center gap-1 rounded-full transition-all duration-500 ease-[var(--ease-out-expo)] ${
          scrolled
            ? 'px-2 py-1 shadow-[var(--shadow-glow)] ring-1 ring-[color-mix(in_oklab,var(--color-primary)_35%,transparent)]'
            : 'px-2 py-1.5 shadow-[var(--shadow-card)]'
        }`}
      >
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-foreground/5"
        >
          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold lowercase text-background">
            cc
          </span>
          <span>make_cc</span>
        </Link>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        {/* 콘텐츠 링크 (데스크톱에서 노출 — 모바일 폭 보호) */}
        <span className="hidden items-center gap-1 md:flex">
          <NavLink href="/demo">예시</NavLink>
          <NavLink href="/blog">블로그</NavLink>
          <NavLink href="/guide">가이드</NavLink>
        </span>

        <NavLink href="/upload">업로드</NavLink>
        {email && <NavLink href="/jobs">내 이력</NavLink>}
        <DiscordInviteLink className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground sm:inline-flex" />

        <ThemeToggle className="ml-0.5" />

        {email ? (
          <Link
            href="/account"
            title={`${email} · 계정`}
            className="ml-1 flex items-center gap-2 rounded-full border border-border/60 bg-foreground/5 py-1 pl-1 pr-3 transition hover:bg-foreground/10"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--aurora-purple)] to-[var(--aurora-magenta)] text-[11px] font-bold uppercase text-white">
              {email[0]}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
              {email}
            </span>
          </Link>
        ) : (
          <Magnetic strength={0.5} className="ml-1">
            <Button asChild variant="default" size="sm" className="rounded-full">
              <Link href="/login">로그인</Link>
            </Button>
          </Magnetic>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
