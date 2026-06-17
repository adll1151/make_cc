'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FloatingNav } from '@/components/ui/floating-nav';
import { JobCard, EmptyState, type JobListItem } from '@/features/history';
import { Button } from '@/components/ui/button';

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs?limit=50');
      const json = await res.json();
      if (!res.ok) {
        if (json?.error?.code === 'AUTH_REQUIRED') {
          setError('로그인이 필요합니다.');
          return;
        }
        setError(json?.error?.message ?? '이력 조회 실패');
        return;
      }
      setJobs(json.data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onShare = useCallback((jobId: string) => {
    window.location.href = `/editor/${jobId}?share=1`;
  }, []);

  const onDelete = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/account/jobs/${jobId}`, { method: 'DELETE' });
        if (res.ok) {
          setJobs((prev) => prev?.filter((j) => j.jobId !== jobId) ?? null);
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <div className="grain-overlay" aria-hidden />
      <FloatingNav />

      <section className="container mx-auto max-w-4xl px-6 pb-16 pt-32 sm:pt-36">
        <header className="enter-fade-up mb-8">
          <h1 className="text-display text-3xl sm:text-4xl">
            <span className="text-gradient">내 이력</span>
          </h1>
          <p className="mt-2 text-muted-foreground">최근 처리한 영상과 자막을 확인하세요.</p>
        </header>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-card/40" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="bento p-6 text-center">
            <p className="font-semibold text-destructive">{error}</p>
            {error.includes('로그인') ? (
              <Button asChild className="mt-4" variant="gradient">
                <Link href="/login">로그인 / 회원가입</Link>
              </Button>
            ) : (
              <Button onClick={load} className="mt-4" variant="outline">
                다시 시도
              </Button>
            )}
          </div>
        )}

        {!loading && !error && jobs?.length === 0 && <EmptyState />}

        {!loading && !error && jobs && jobs.length > 0 && (
          <div className="enter-stagger grid gap-3">
            {jobs.map((j) => (
              <JobCard key={j.jobId} job={j} onShare={onShare} onDelete={onDelete} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
