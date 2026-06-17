'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes, formatDuration } from '@/features/upload';

export interface JobListItem {
  jobId: string;
  status: string;
  progressPercent: number;
  videoOriginalName: string;
  videoDurationSec: number;
  videoSizeBytes: number;
  hasSubtitle: boolean;
  hasVideo: boolean;
  videoDeleteAt: string | null;
  createdAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export function JobCard({
  job,
  onShare,
  onDelete,
}: {
  job: JobListItem;
  onShare?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const created = new Date(job.createdAt);
  const expiresAtText = formatExpiry(job.videoDeleteAt);

  return (
    <article className="bento group flex flex-col gap-3 p-5">
      <header className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FilmIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold tracking-tight" title={job.videoOriginalName}>
            {job.videoOriginalName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(job.videoSizeBytes)} · {formatDuration(job.videoDurationSec)} ·{' '}
            {formatRelative(created)}
          </p>
        </div>
        <StatusBadge status={job.status} percent={job.progressPercent} />
      </header>

      {job.errorMessage && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {job.errorMessage}
        </p>
      )}

      {expiresAtText && (
        <p className="text-xs text-muted-foreground/60">
          영상 자동 삭제 예정: {expiresAtText}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2 pt-1">
        {job.status === 'finished' && job.hasSubtitle && (
          <>
            <Button asChild variant="gradient" size="sm">
              <Link href={`/editor/${job.jobId}`}>편집기</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/subtitles/${job.jobId}/download`}>SRT</a>
            </Button>
            {onShare && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onShare(job.jobId)}
              >
                <ShareIcon />
                공유
              </Button>
            )}
          </>
        )}
        {(job.status === 'queued' || job.status === 'transcribing') && (
          <span className="text-xs text-muted-foreground">처리 중...</span>
        )}
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirm('이 영상·자막을 영구 삭제할까요?')) return;
              setDeleting(true);
              await onDelete(job.jobId);
              setDeleting(false);
            }}
            className={cn(
              'ml-auto text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50',
            )}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        )}
      </footer>
    </article>
  );
}

function StatusBadge({ status, percent }: { status: string; percent: number }) {
  const colorVar =
    status === 'finished'
      ? 'var(--color-success)'
      : status === 'failed' || status === 'cancelled'
        ? 'var(--color-destructive)'
        : 'var(--color-primary)';
  const label =
    status === 'finished'
      ? '완료'
      : status === 'transcribing'
        ? `처리 중 ${percent}%`
        : status === 'queued'
          ? '대기 중'
          : status === 'failed'
            ? '실패'
            : status === 'cancelled'
              ? '취소'
              : status === 'uploading'
                ? '업로드 중'
                : status === 'pending'
                  ? '대기'
                  : status;
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${colorVar} 12%, var(--color-card) 88%)`,
        color: colorVar,
        border: `1px solid color-mix(in oklab, ${colorVar} 30%, transparent 70%)`,
      }}
    >
      {label}
    </span>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy}일 전`;
  return d.toLocaleDateString('ko-KR');
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 3600_000));
  if (days < 0) return null;
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  return `${days}일 후 (${d.toLocaleDateString('ko-KR')})`;
}

function FilmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
