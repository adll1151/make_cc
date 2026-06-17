'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (status.kind === 'sending') return;
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
      setStatus({ kind: 'error', message: '이메일 형식이 올바르지 않습니다.' });
      return;
    }
    setStatus({ kind: 'sending' });
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/upload` },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'sent', email });
  }

  async function handleGoogle() {
    setStatus({ kind: 'sending' });
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/upload` },
    });
    if (error) setStatus({ kind: 'error', message: error.message });
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <div className="grain-overlay" aria-hidden />
      <FloatingNav />

      <section className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        {status.kind === 'sent' ? (
          <SentCard email={status.email} onReset={() => setStatus({ kind: 'idle' })} />
        ) : (
          <div className="w-full enter-fade-up">
            <div className="bento p-8 backdrop-blur-xl">
              <header className="mb-8 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserIcon />
                </div>
                <h1 className="text-display text-2xl sm:text-3xl">
                  <span className="text-gradient">로그인</span>{' '}
                  <span className="text-muted-foreground">/</span>{' '}
                  <span className="text-aurora">회원가입</span>
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  이메일 또는 Google로 시작하세요. 별도 회원가입 없음.
                </p>
              </header>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-xs font-medium text-muted-foreground">
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status.kind === 'sending'}
                    className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-base outline-none backdrop-blur-sm transition placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  disabled={status.kind === 'sending'}
                >
                  {status.kind === 'sending' ? '전송 중...' : '로그인 링크 받기'}
                </Button>
              </form>

              <div className="relative my-6 flex items-center">
                <div className="flex-grow border-t border-border" />
                <span className="mx-4 text-xs text-muted-foreground/60">또는</span>
                <div className="flex-grow border-t border-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogle}
                disabled={status.kind === 'sending'}
              >
                <GoogleIcon />
                <span>Google로 계속하기</span>
              </Button>

              {status.kind === 'error' && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {status.message}
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              로그인 시 이용약관과 개인정보처리방침에 동의한 것으로 간주됩니다.
              <br />
              업로드된 영상은 학습에 사용되지 않으며, 처리 후 자동 삭제됩니다.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function SentCard({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="w-full enter-fade-up">
      <div className="bento p-10 text-center backdrop-blur-xl">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <MailIcon />
        </div>
        <h1 className="text-display text-3xl">
          <span className="text-aurora">메일 확인</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{email}</span>로<br />
          로그인 링크를 보냈습니다.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-6 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          다른 이메일로 시도
        </button>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M12 5.04c1.83 0 3.43.63 4.71 1.85l3.5-3.51C18.16 1.13 15.36 0 12 0 7.36 0 3.36 2.69 1.42 6.59l4.07 3.16C6.46 6.92 9 5.04 12 5.04z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47c-.28 1.46-1.13 2.7-2.39 3.53l3.86 2.99c2.26-2.09 3.55-5.17 3.55-8.76z" />
      <path fill="#FBBC05" d="M5.49 14.27c-.25-.7-.4-1.45-.4-2.27s.15-1.57.4-2.27L1.42 6.57C.52 8.27 0 10.07 0 12s.52 3.73 1.42 5.43l4.07-3.16z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.86-2.99c-1.07.72-2.45 1.15-4.08 1.15-3.01 0-5.55-2.05-6.47-4.79L1.46 17.6C3.42 21.41 7.36 24 12 24z" />
    </svg>
  );
}
