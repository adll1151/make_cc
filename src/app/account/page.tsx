'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { DiscordLinkSection } from '@/features/account/DiscordLinkSection';

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setLoaded(true);
    })();
  }, []);

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <FloatingNav />

      <section className="container mx-auto max-w-2xl px-6 pb-16 pt-32 sm:pt-36">
        <header className="enter-fade-up mb-8">
          <h1 className="text-display text-3xl sm:text-4xl">
            <span className="text-gradient">계정</span>
          </h1>
        </header>

        {loaded && !email && (
          <div className="bento p-6 text-center">
            <p className="font-semibold text-destructive">로그인이 필요합니다.</p>
            <Button asChild className="mt-4" variant="gradient">
              <Link href="/login">로그인 / 회원가입</Link>
            </Button>
          </div>
        )}

        {loaded && email && (
          <div className="space-y-4">
            <div className="bento p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">로그인 정보</p>
              <p className="mt-2 font-mono">{email}</p>
            </div>

            <DiscordLinkSection />

            <div className="bento p-5">
              <h3 className="font-semibold tracking-tight">데이터 관리</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                각 영상의 삭제는 <Link href="/jobs" className="underline-offset-2 hover:underline">이력 페이지</Link>에서 카드별로 가능합니다.
              </p>
            </div>

            <div className="bento p-5">
              <h3 className="font-semibold tracking-tight">자동 삭제 정책</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>· 회원: 처리 완료 30일 후 영상 자동 삭제 (자막은 유지)</li>
                <li>· 게스트: 처리 완료 후 약 1시간 내 영상 자동 삭제</li>
                <li>· 학습에 사용되지 않음</li>
              </ul>
            </div>

            <div className="bento p-5">
              <button
                type="button"
                onClick={signOut}
                className="text-sm text-muted-foreground transition hover:text-destructive"
              >
                로그아웃
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
