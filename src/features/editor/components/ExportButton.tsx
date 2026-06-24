'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLanguage } from '@/services/translation/languages';
import type { CaptionAspect } from '@/types/caption-style';
import type { TranslationView } from '@/types/translation';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 번인 영상 내보내기 (Design §5.1) — 자막 언어·비율·화질 선택 + createRender 호출.
 * POST /api/renders → renderId를 store에 저장 → RenderProgress가 폴링.
 * 화질 게이팅(무료=720+워터마크)은 서버가 강제하므로 여기선 안내만 한다.
 * 자막 언어는 원본(ko) + 완료된 번역 트랙만 선택 가능.
 */
const ASPECTS: { value: CaptionAspect; label: string }[] = [
  { value: 'original', label: '원본' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
];

interface LangOption {
  code: string;
  label: string;
}

export function ExportButton({ jobId }: { jobId: string }) {
  const aspect = useCaptionStyle((s) => s.aspect);
  const resolution = useCaptionStyle((s) => s.resolution);
  const style = useCaptionStyle((s) => s.style);
  const subtitleLang = useCaptionStyle((s) => s.subtitleLang);
  const renderId = useCaptionStyle((s) => s.renderId);
  const setAspect = useCaptionStyle((s) => s.setAspect);
  const setResolution = useCaptionStyle((s) => s.setResolution);
  const setSubtitleLang = useCaptionStyle((s) => s.setSubtitleLang);
  const setRenderId = useCaptionStyle((s) => s.setRenderId);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langOptions, setLangOptions] = useState<LangOption[]>([{ code: 'ko', label: '한국어 (원본)' }]);

  const inProgress = renderId !== null;

  // 완료된 번역 트랙을 자막 언어 옵션으로 추가
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/translations`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const done = ((json.data as TranslationView[]) ?? []).filter((t) => t.status === 'done');
        if (done.length === 0) return;
        const opts: LangOption[] = [
          { code: 'ko', label: '한국어 (원본)' },
          ...done.map((t) => {
            const m = getLanguage(t.targetLang);
            return { code: t.targetLang, label: m ? `${m.flag} ${m.nativeName}` : t.targetLang };
          }),
        ];
        setLangOptions(opts);
      } catch {
        // 무시 — 원본만 노출
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function handleExport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/renders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, aspect, resolution, style, subtitleLang }),
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
      {/* 자막 언어 — 완료된 번역이 있을 때만 노출 */}
      {langOptions.length > 1 && (
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-muted-foreground">자막 언어</span>
          <div className="inline-flex flex-wrap gap-1.5">
            {langOptions.map((l) => (
              <Chip
                key={l.code}
                active={subtitleLang === l.code}
                disabled={inProgress}
                onClick={() => setSubtitleLang(l.code)}
              >
                {l.label}
              </Chip>
            ))}
          </div>
          {subtitleLang !== 'ko' && style.karaoke && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              번역 자막은 단어 타이밍이 없어 카라오케 하이라이트가 적용되지 않아요.
            </p>
          )}
        </div>
      )}

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
