'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Cue } from '@/types/subtitle';
import { shortTimecode } from '../lib/timecode-format';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { speakerColor, speakerLabel } from '../lib/speaker-color';

interface CueItemProps {
  cue: Cue;
  isActive: boolean;
  onSeek(startMs: number): void;
}

export function CueItem({ cue, isActive, onSeek }: CueItemProps) {
  const updateCueText = useSubtitleStore((s) => s.updateCueText);
  const speakerMap = useSubtitleStore((s) => s.speakerMap);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cue.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(cue.text);
  }, [cue.text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      adjustHeight(textareaRef.current);
    }
  }, [editing]);

  const commit = () => {
    if (draft !== cue.text) {
      updateCueText(cue.index, draft);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(cue.text);
    setEditing(false);
  };

  return (
    <li
      data-cue-index={cue.index}
      data-active={isActive || undefined}
      className={cn(
        'group relative rounded-xl border p-3 transition-all',
        isActive
          ? 'border-primary/40 bg-primary/5 shadow-[var(--shadow-glow)]'
          : 'border-border/60 bg-card/30 hover:border-border-strong hover:bg-card/60',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => onSeek(cue.startMs)}
          className="font-mono text-muted-foreground tabular-nums transition hover:text-primary"
          title="이 시각으로 이동"
        >
          <span className={cn(isActive && 'font-semibold text-primary')}>
            {shortTimecode(cue.startMs)}
          </span>
          <span className="mx-1.5 text-muted-foreground/40">→</span>
          <span className={cn(isActive && 'font-semibold text-primary')}>
            {shortTimecode(cue.endMs)}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {cue.speakerId && (
            <span
              className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium"
              style={{ color: speakerColor(cue.speakerId).text }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: speakerColor(cue.speakerId).dot }}
              />
              {speakerLabel(cue.speakerId, speakerMap)}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground/50">#{cue.index}</span>
        </div>
      </div>

      <div className="mt-2">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              adjustHeight(e.target);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                cancel();
              }
            }}
            rows={1}
            maxLength={200}
            className="w-full resize-none rounded-md bg-background/60 px-2 py-1.5 text-sm leading-relaxed outline-none ring-1 ring-primary/40 focus:ring-2 focus:ring-primary/60"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            onDoubleClick={() => setEditing(true)}
            className="w-full text-left text-sm leading-relaxed text-foreground transition hover:text-primary"
            title="클릭하여 편집"
          >
            {cue.text.split('\n').map((line, i) => (
              <span key={i}>
                {line || ' '}
                {i < cue.text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </button>
        )}
      </div>
    </li>
  );
}

function adjustHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
