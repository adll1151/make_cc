'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CaptionAspect } from '@/types/caption-style';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 번인 영상 내보내기 (Design §5.1) — 비율·화질 선택 + createRender 호출.
 * POST /api/renders → renderId를 store에 저장 → RenderProgress가 폴링.
 * 화질 게이팅(무료=720+워터마크)은 서버가 강제하므로 여기선 안내만 한다.
 */
const ASPECTS: { value: CaptionAspect; label: string }[] = [
  { value: 'original', label: '원본' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
];

export function ExportButton({ jobId }: { jobId: string }) {
  const aspect = useCaptionStyle((s) => s.aspect);
  const resolution = useCaptionStyle((s) => s.resolution);
  const style = useCaptionStyle((s) => s.style);
  const renderId = useCaptionStyle((s) => s.renderId);
  const setAspect = useCaptionStyle((s) => s.setAspect);
  const setResolution = useCaptionStyle((s) => s.setResolution);
  const setRenderId = useCaptionStyle((s) => s.setRenderId);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inProgress = renderId !== null;

  async function handleExport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/renders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, aspect, resolution, style }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message ?? '내보내기 요청 실패');
      }
      setRenderId(json.data.renderId as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 요청 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-muted-foreground">비율</span>
        <div className="inline-flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <Chip
              key={a.value}
              active={aspect === a.value}
              disabled={inProgress}
              onClick={() => setAspect(a.value)}
            >
              {a.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-semibold text-muted-foreground">화질</span>
        <div className="inline-flex flex-wrap gap-1.5">
          <Chip active={resolution === 720} disabled={inProgress} onClick={() => setResolution(720)}>
            720p
          </Chip>
          <Chip active={resolution === 1080} disabled={inProgress} onClick={() => setResolution(1080)}>
            1080p · Pro
          </Chip>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          무료 플랜은 워터마크와 함께 720p로 출력됩니다. 1080p·워터마크 제거는 Pro 전용이에요.
        </p>
      </div>

      <Button
        type="button"
        variant="gradient"
        size="lg"
        className="w-full"
        onClick={handleExport}
        disabled={submitting || inProgress}
      >
        {submitting ? '요청 중...' : inProgress ? '렌더 진행 중...' : '번인 영상 내보내기'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-50',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
