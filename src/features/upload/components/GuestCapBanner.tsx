import Link from 'next/link';
import { GUEST_CAPS, MEMBER_CAPS, formatBytes, formatDuration } from '../lib/guest-caps';

/**
 * 게스트 캡 안내 배너 + 회원가입 CTA.
 *
 * 모던 CSS:
 *   - color-mix()로 다양한 강도의 배경/테두리
 *   - text-wrap: pretty (자동 적용)
 *   - @starting-style (.enter-fade-up)
 */
export function GuestCapBanner({
  variant = 'default',
  reason,
}: {
  variant?: 'default' | 'exceeded';
  reason?: string;
}) {
  if (variant === 'exceeded') {
    return (
      <div
        className="enter-fade-up mb-4 overflow-hidden rounded-2xl border p-5 shadow-[var(--shadow-card)]"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-destructive) 30%, transparent 70%)',
          backgroundColor: 'color-mix(in oklab, var(--color-destructive) 6%, var(--color-card) 94%)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-destructive"
            style={{
              backgroundColor:
                'color-mix(in oklab, var(--color-destructive) 15%, var(--color-card) 85%)',
            }}
          >
            <ExclamationIcon />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-semibold text-destructive">게스트 한도 초과</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {reason ??
                  `게스트는 ${formatDuration(GUEST_CAPS.durationSec)} 이내, ${formatBytes(GUEST_CAPS.sizeBytes)} 이하 영상만 처리 가능합니다.`}
              </p>
            </div>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:gap-2.5"
            >
              회원가입 시 {formatDuration(MEMBER_CAPS.durationSec)} ·{' '}
              {formatBytes(MEMBER_CAPS.sizeBytes)}까지 가능
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="enter-fade-up mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: 'color-mix(in oklab, var(--color-primary) 20%, transparent 80%)',
        backgroundColor: 'color-mix(in oklab, var(--color-primary) 4%, var(--color-card) 96%)',
      }}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <SparklesIcon />
      </div>
      <p className="flex-1 text-muted-foreground">
        <span className="font-semibold text-foreground">게스트 체험:</span>{' '}
        {formatDuration(GUEST_CAPS.durationSec)} 이내 · {formatBytes(GUEST_CAPS.sizeBytes)} 이하 1회.
      </p>
      <Link
        href="/login"
        className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
      >
        회원가입
      </Link>
    </div>
  );
}

function ExclamationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
