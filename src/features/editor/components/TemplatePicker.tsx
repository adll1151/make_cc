'use client';

import { cn } from '@/lib/utils';
import { CAPTION_TEMPLATES } from '../lib/caption-templates';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 자막 프리셋 선택 (Design §5.1). 현재 적용된 템플릿 키를 강조.
 * 커스텀 편집 후에는(template==='custom') 어느 칩도 활성화되지 않는다.
 */
export function TemplatePicker() {
  const current = useCaptionStyle((s) => s.style.template);
  const applyTemplate = useCaptionStyle((s) => s.applyTemplate);

  return (
    <div className="flex flex-wrap gap-2">
      {CAPTION_TEMPLATES.map((t) => {
        const active = current === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTemplate(t.key)}
            aria-pressed={active}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
