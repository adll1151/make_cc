'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Magnetic } from '@/components/motion/Magnetic';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DiscordInviteLink } from '@/components/DiscordInviteLink';
import { createBrowserSupabase } from '@/lib/supabase/browser';

/**
 * 상단 중앙 pill nav. 데스크톱은 인라인 링크, 모바일(<md)은 햄버거 메뉴로 펼친다.
 * 로그인 시 이메일+아바타 칩, 비로그인 시 "로그인" 버튼.
 */
export function FloatingNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Esc로 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <nav
      className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 enter-fade-up transition-all duration-500 ease-[var(--ease-out-expo)] ${
        scrolled ? 'top-3 scale-[0.96]' : ''
      }`}
    >
      <div
        className={`glass-strong relative flex items-center gap-1 rounded-full transition-all duration-500 ease-[var(--ease-out-expo)] ${
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

        {/* ===== 데스크톱 인라인 링크 ===== */}
        <span className="hidden items-center gap-1 md:flex">
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <NavLink href="/demo">예시</NavLink>
          <NavLink href="/blog">블로그</NavLink>
          <NavLink href="/guide">가이드</NavLink>
          <NavLink href="/upload">업로드</NavLink>
          {email && <NavLink href="/jobs">내 이력</NavLink>}
          <DiscordInviteLink className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground" />
        </span>

        <ThemeToggle className="ml-0.5" />

        {/* 데스크톱 로그인/계정 */}
        <span className="hidden md:inline-flex">
          {email ? (
            <Link
              href="/account"
              title={`${email} · 계정`}
              className="ml-1 flex items-center gap-2 rounded-full border border-border/60 bg-foreground/5 py-1 pl-1 pr-3 transition hover:bg-foreground/10"
            >
              <Avatar email={email} />
              <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline">{email}</span>
            </Link>
          ) : (
            <Magnetic strength={0.5} className="ml-1">
              <Button asChild variant="default" size="sm" className="rounded-full">
                <Link href="/login">로그인</Link>
              </Button>
            </Magnetic>
          )}
        </span>

        {/* ===== 모바일 햄버거 ===== */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
          className="ml-0.5 flex size-8 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/10 md:hidden"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {/* 모바일 드롭다운 패널 */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={close}
              className="fixed inset-0 cursor-default md:hidden"
            />
            <div className="absolute right-0 top-full z-10 mt-2 w-52 origin-top-right rounded-2xl glass-strong p-2 shadow-[var(--shadow-card)] md:hidden">
              <MobileLink href="/demo" onClick={close}>예시</MobileLink>
              <MobileLink href="/blog" onClick={close}>블로그</MobileLink>
              <MobileLink href="/guide" onClick={close}>가이드</MobileLink>
              <MobileLink href="/upload" onClick={close}>업로드</MobileLink>
              {email && (
                <MobileLink href="/jobs" onClick={close}>
                  내 이력
                </MobileLink>
              )}
              <DiscordInviteLink className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground" />
              <div className="my-1 h-px bg-border" aria-hidden />
              {email ? (
                <Link
                  href="/account"
                  onClick={close}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-foreground/5"
                >
                  <Avatar email={email} />
                  <span className="truncate">{email}</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={close}
                  className="block rounded-lg bg-foreground px-3 py-2 text-center text-sm font-semibold text-background transition hover:opacity-90"
                >
                  로그인
                </Link>
              )}
            </div>
          </>
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

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function Avatar({ email }: { email: string }) {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--aurora-purple)] to-[var(--aurora-magenta)] text-[11px] font-bold uppercase text-white">
      {email[0]}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
