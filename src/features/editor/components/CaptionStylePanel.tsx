'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CaptionFont, CaptionPosition } from '@/types/caption-style';
import { useCaptionStyle } from '../hooks/useCaptionStyle';
import { TemplatePicker } from './TemplatePicker';
import { CaptionSuggestion } from './CaptionSuggestion';

/**
 * 자막 스타일 편집 패널 (Design §5.1/§5.2).
 * 프리셋(TemplatePicker) + 폰트·크기·색·외곽선·위치·박스·카라오케 커스텀.
 * 모든 변경은 useCaptionStyle.patchStyle → 미리보기(CaptionPreview)에 즉시 반영.
 */
const FONTS: { value: CaptionFont; label: string }[] = [
  { value: 'Pretendard', label: 'Pretendard' },
  { value: 'NotoSansKR', label: 'Noto Sans KR' },
];

const POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: 'bottom', label: '하단' },
  { value: 'middle', label: '중앙' },
  { value: 'top', label: '상단' },
];

export function CaptionStylePanel() {
  const style = useCaptionStyle((s) => s.style);
  const patch = useCaptionStyle((s) => s.patchStyle);

  return (
    <div className="space-y-5">
      <CaptionSuggestion />

      <Field label="프리셋">
        <TemplatePicker />
      </Field>

      <Field label="폰트">
        <SegmentedGroup>
          {FONTS.map((f) => (
            <Segment
              key={f.value}
              active={style.fontFamily === f.value}
              onClick={() => patch({ fontFamily: f.value })}
            >
              {f.label}
            </Segment>
          ))}
        </SegmentedGroup>
      </Field>

      <Field label={`글자 크기 (${style.fontSizePct.toFixed(1)}%)`}>
        <input
          type="range"
          min={3}
          max={12}
          step={0.5}
          value={style.fontSizePct}
          onChange={(e) => patch({ fontSizePct: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="글자 색">
          <ColorInput value={style.color} onChange={(color) => patch({ color })} />
        </Field>
        <Field label="외곽선 색">
          <ColorInput
            value={style.outlineColor}
            onChange={(outlineColor) => patch({ outlineColor })}
          />
        </Field>
      </div>

      <Field label={`외곽선 두께 (${style.outlineWidth.toFixed(1)})`}>
        <input
          type="range"
          min={0}
          max={6}
          step={0.5}
          value={style.outlineWidth}
          onChange={(e) => patch({ outlineWidth: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </Field>

      <Field label="위치">
        <SegmentedGroup>
          {POSITIONS.map((p) => (
            <Segment
              key={p.value}
              active={style.position === p.value}
              onClick={() => patch({ position: p.value })}
            >
              {p.label}
            </Segment>
          ))}
        </SegmentedGroup>
      </Field>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Toggle
          label="하단 박스"
          checked={style.box}
          onChange={(box) => patch({ box })}
        />
        <Toggle
          label="카라오케"
          checked={style.karaoke}
          onChange={(karaoke) => patch({ karaoke })}
        />
        {style.karaoke && (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            강조 색
            <ColorInput
              value={style.karaokeColor}
              onChange={(karaokeColor) => patch({ karaokeColor })}
            />
          </label>
        )}
      </div>

      {style.karaoke && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          카라오케는 단어 타이밍이 있는 영상에서만 단어별로 하이라이트됩니다. 없으면 자동으로 평문 처리돼요.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function SegmentedGroup({ children }: { children: ReactNode }) {
  return <div className="inline-flex flex-wrap gap-1.5">{children}</div>;
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
    </span>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs font-semibold text-foreground"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors duration-200',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}
