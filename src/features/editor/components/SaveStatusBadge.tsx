'use client';

import { useEffect, useState } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';

export function SaveStatusBadge() {
  const status = useSubtitleStore((s) => s.saveStatus);
  const lastSaveError = useSubtitleStore((s) => s.lastSaveError);
  const lastSavedAt = useSubtitleStore((s) => s.lastSavedAt);
  const dirty = useSubtitleStore((s) => s.dirty);

  // 마지막 저장 후 N초 표시
  const [, tick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  const ago = lastSavedAt ? formatAgo(Date.now() - lastSavedAt) : null;

  if (status === 'saving') {
    return (
      <Badge tone="primary" icon={<SpinnerIcon />}>
        저장 중...
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge tone="destructive" icon={<WarnIcon />} title={lastSaveError ?? undefined}>
        저장 실패 — 다시 시도됩니다
      </Badge>
    );
  }
  if (status === 'dirty' || dirty) {
    return (
      <Badge tone="accent" icon={<DotIcon />}>
        미저장 변경 (5초 후 자동 저장)
      </Badge>
    );
  }
  if (status === 'saved') {
    return (
      <Badge tone="success" icon={<CheckIcon />}>
        저장됨{ago ? ` · ${ago} 전` : ''}
      </Badge>
    );
  }
  return null;
}

function Badge({
  tone,
  icon,
  children,
  title,
}: {
  tone: 'primary' | 'accent' | 'success' | 'destructive';
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  const colorVar =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'destructive'
        ? 'var(--color-destructive)'
        : tone === 'accent'
          ? 'var(--color-accent)'
          : 'var(--color-primary)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${colorVar} 12%, var(--color-card) 88%)`,
        color: colorVar,
        border: `1px solid color-mix(in oklab, ${colorVar} 30%, transparent 70%)`,
      }}
      title={title}
    >
      {icon}
      {children}
    </span>
  );
}

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return '방금';
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return `${m}분`;
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function DotIcon() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
function WarnIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
