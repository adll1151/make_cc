'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShareInfo {
  token: string;
  url: string;
  hits?: number;
}

interface ShareLinkCardProps {
  jobId: string;
  initial?: ShareInfo | null;
}

export function ShareLinkCard({ jobId, initial = null }: ShareLinkCardProps) {
  const [info, setInfo] = useState<ShareInfo | null>(initial);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? '공유 링크 생성 실패');
        return;
      }
      setInfo(json.data);
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!info) return;
    if (!confirm('이 공유 링크를 폐기할까요? 기존 링크는 더 이상 동작하지 않습니다.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/share/${info.token}`, { method: 'DELETE' });
      if (res.ok) setInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!info) {
    return (
      <div className="bento p-5">
        <h3 className="font-semibold tracking-tight">공유 링크</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          링크를 만들면 누구나 SRT 자막을 다운로드 받을 수 있어요. 영상은 공개되지 않습니다.
        </p>
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="gradient"
          size="sm"
          className="mt-4"
          onClick={create}
          disabled={loading}
        >
          {loading ? '생성 중...' : '공유 링크 만들기'}
        </Button>
      </div>
    );
  }

  return (
    <div className="bento p-5">
      <h3 className="flex items-center gap-2 font-semibold tracking-tight">
        <ShareIcon />
        공유 링크
      </h3>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{info.url}</code>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition',
            copied ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary hover:bg-primary/20',
          )}
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{typeof info.hits === 'number' ? `다운로드 ${info.hits}회` : '활성'}</span>
        <button
          type="button"
          onClick={revoke}
          disabled={loading}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          {loading ? '폐기 중...' : '공유 중지'}
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
