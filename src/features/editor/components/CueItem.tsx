'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Cue } from '@/types/subtitle';
import { shortTimecode, formatEditTimecode, parseEditTimecode } from '../lib/timecode-format';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { speakerColor, speakerLabel } from '../lib/speaker-color';
import { computeCps } from '../lib/caption-signals';

interface CueItemProps {
  cue: Cue;
  /** cues 배열 내 위치 (activeIndex/selectedIndex와 비교) */
  idx: number;
  isActive: boolean;
  isSelected: boolean;
  /** 뒤에 자막 삽입 가능 여부(간격 존재 or 마지막) */
  canAddAfter: boolean;
  onSeek(startMs: number): void;
  onPlayCue(startMs: number, endMs: number): void;
  /** 현재 영상 재생 위치(ms) — "영상 위치로" 버튼용 */
  getCurrentMs(): number;
}

export function CueItem({
  cue,
  idx,
  isActive,
  isSelected,
  canAddAfter,
  onSeek,
  onPlayCue,
  getCurrentMs,
}: CueItemProps) {
  const updateCueText = useSubtitleStore((s) => s.updateCueText);
  const updateCueTiming = useSubtitleStore((s) => s.updateCueTiming);
  const deleteCue = useSubtitleStore((s) => s.deleteCue);
  const addCueAfter = useSubtitleStore((s) => s.addCueAfter);
  const speakerMap = useSubtitleStore((s) => s.speakerMap);
  const editing = useSubtitleStore((s) => s.editingIndex === idx);
  const setSelectedIndex = useSubtitleStore((s) => s.setSelectedIndex);
  const setEditingIndex = useSubtitleStore((s) => s.setEditingIndex);

  const [draft, setDraft] = useState(cue.text);
  const [timeEditing, setTimeEditing] = useState(false);
  const [startStr, setStartStr] = useState(() => formatEditTimecode(cue.startMs));
  const [endStr, setEndStr] = useState(() => formatEditTimecode(cue.endMs));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(cue.text), [cue.text]);
  useEffect(() => setStartStr(formatEditTimecode(cue.startMs)), [cue.startMs]);
  useEffect(() => setEndStr(formatEditTimecode(cue.endMs)), [cue.endMs]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      adjustHeight(textareaRef.current);
    }
  }, [editing]);

  const startEdit = () => {
    setSelectedIndex(idx);
    setEditingIndex(idx);
  };

  const selectAndSeek = () => {
    setSelectedIndex(idx);
    onSeek(cue.startMs);
  };

  const commit = (advance: boolean) => {
    if (draft !== cue.text) updateCueText(cue.index, draft);
    if (advance) {
      const cues = useSubtitleStore.getState().cues;
      const next = idx + 1;
      if (next < cues.length) {
        setSelectedIndex(next);
        setEditingIndex(next);
        return;
      }
    }
    setEditingIndex(null);
  };

  const cancel = () => {
    setDraft(cue.text);
    setEditingIndex(null);
  };

  // 타임코드 적용 헬퍼
  const applyStart = (ms: number) => updateCueTiming(cue.index, ms, cue.endMs);
  const applyEnd = (ms: number) => updateCueTiming(cue.index, cue.startMs, ms);
  const commitStartStr = () => {
    const ms = parseEditTimecode(startStr);
    if (ms !== null) applyStart(ms);
    else setStartStr(formatEditTimecode(cue.startMs));
  };
  const commitEndStr = () => {
    const ms = parseEditTimecode(endStr);
    if (ms !== null) applyEnd(ms);
    else setEndStr(formatEditTimecode(cue.endMs));
  };

  // CPS (읽기 속도) — caption-signals의 computeCps 단일 출처
  const cps = computeCps(cue.text, cue.endMs - cue.startMs);
  // 리치 CC — 비음성 사운드 큐(♪음악♪·[웃음]…)는 대사와 시각 구분(앰버 톤·🔊), CPS 미표시
  const isSound = cue.kind === 'sound';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-cue-index={cue.index}
      data-active={isActive || undefined}
      data-selected={isSelected || undefined}
      onClick={() => {
        if (!editing) selectAndSeek();
      }}
      className={cn(
        'group relative cursor-pointer rounded-xl border p-3 transition-colors',
        isActive
          ? 'border-primary/40 bg-primary/5 shadow-[var(--shadow-glow)]'
          : isSelected
            ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/30'
            : isSound
              ? 'border-amber-500/25 bg-amber-500/[0.05] hover:border-amber-500/40 hover:bg-amber-500/[0.08]'
              : 'border-border/60 bg-card/30 hover:border-border-strong hover:bg-card/60',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIndex(idx);
              onPlayCue(cue.startMs, cue.endMs);
            }}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            title="이 구간 재생"
            aria-label="이 구간 재생"
          >
            <PlayIcon />
          </button>
          <span className="font-mono tabular-nums">
            <span className={cn('text-muted-foreground', isActive && 'font-semibold text-primary')}>
              {shortTimecode(cue.startMs)}
            </span>
            <span className="mx-1 text-muted-foreground/40">→</span>
            <span className={cn('text-muted-foreground', isActive && 'font-semibold text-primary')}>
              {shortTimecode(cue.endMs)}
            </span>
          </span>
          {isSound ? <SoundBadge /> : <CpsBadge cps={cps} />}
        </div>

        {/* 액션 버튼 (호버/선택 시 노출) */}
        <div
          className={cn(
            'flex items-center gap-1.5 transition-opacity',
            isSelected || timeEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {cue.speakerId && (
            <span
              className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium opacity-100"
              style={{ color: speakerColor(cue.speakerId).text }}
            >
              <span className="size-1.5 rounded-full" style={{ background: speakerColor(cue.speakerId).dot }} />
              {speakerLabel(cue.speakerId, speakerMap)}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground/50">#{cue.index}</span>
          <IconBtn
            title="시간 편집"
            active={timeEditing}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIndex(idx);
              setTimeEditing((v) => !v);
            }}
          >
            <ClockIcon />
          </IconBtn>
          {!editing && (
            <IconBtn title="텍스트 편집 (Enter)" onClick={(e) => { e.stopPropagation(); startEdit(); }}>
              <PencilIcon />
            </IconBtn>
          )}
          <IconBtn
            title={canAddAfter ? '아래에 자막 추가' : '간격이 없어 추가할 수 없어요'}
            disabled={!canAddAfter}
            onClick={(e) => { e.stopPropagation(); addCueAfter(cue.index); }}
          >
            <PlusIcon />
          </IconBtn>
          <IconBtn
            title="자막 삭제"
            danger
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('이 자막을 삭제할까요?')) deleteCue(cue.index);
            }}
          >
            <TrashIcon />
          </IconBtn>
        </div>
      </div>

      {/* 타임코드 편집 행 */}
      {timeEditing && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-background/40 p-2" onClick={(e) => e.stopPropagation()}>
          <TimeRow
            label="시작"
            value={startStr}
            onChange={setStartStr}
            onCommit={commitStartStr}
            onPlayhead={() => applyStart(getCurrentMs())}
            onNudge={(d) => applyStart(cue.startMs + d)}
          />
          <TimeRow
            label="종료"
            value={endStr}
            onChange={setEndStr}
            onCommit={commitEndStr}
            onPlayhead={() => applyEnd(getCurrentMs())}
            onNudge={(d) => applyEnd(cue.endMs + d)}
          />
        </div>
      )}

      <div className="mt-2">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setDraft(e.target.value);
              adjustHeight(e.target);
            }}
            onBlur={() => commit(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit(true);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            rows={1}
            maxLength={200}
            className="w-full resize-none rounded-md bg-background/60 px-2 py-1.5 text-sm leading-relaxed outline-none ring-1 ring-primary/40 focus:ring-2 focus:ring-primary/60"
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            className="text-sm leading-relaxed text-foreground"
            title="더블클릭 또는 Enter로 편집"
          >
            {cue.text.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line || ' '}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function TimeRow({
  label,
  value,
  onChange,
  onCommit,
  onPlayhead,
  onNudge,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  onCommit(): void;
  onPlayhead(): void;
  onNudge(deltaMs: number): void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-7 shrink-0 text-[10px] font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        inputMode="decimal"
        className="w-24 rounded-md bg-background/60 px-2 py-1 font-mono text-xs tabular-nums outline-none ring-1 ring-border focus:ring-primary/60"
        placeholder="mm:ss.mmm"
      />
      <button
        type="button"
        onClick={onPlayhead}
        className="rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        title="현재 영상 위치로 설정"
      >
        영상위치
      </button>
      <button
        type="button"
        onClick={() => onNudge(-100)}
        className="rounded-md border border-border px-1.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        title="-0.1초"
      >
        −0.1s
      </button>
      <button
        type="button"
        onClick={() => onNudge(100)}
        className="rounded-md border border-border px-1.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        title="+0.1초"
      >
        +0.1s
      </button>
    </div>
  );
}

function CpsBadge({ cps }: { cps: number }) {
  if (!Number.isFinite(cps) || cps <= 0) return null;
  // 표준(Netflix/BBC): 최적 ≤15, 허용 최대 17. >17 빨강, 15~17 주황.
  const tone =
    cps > 17 ? 'text-destructive' : cps > 15 ? 'text-amber-500' : 'text-muted-foreground/50';
  return (
    <span
      className={cn('font-mono text-[10px]', tone)}
      title="읽기 속도 (공백 제외 글자수/초) · 표준 권장 ≤15, 최대 17"
    >
      {cps.toFixed(1)}자/초
    </span>
  );
}

/** 사운드(비음성 CC) 큐 배지 — 대사와 구분(앰버 톤 + 음파 아이콘). */
function SoundBadge() {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
      title="비음성 사운드 자막 (CC) — 음악·박수·웃음 등"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2" />
      </svg>
      사운드
    </span>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  active,
  danger,
  disabled,
}: {
  title: string;
  onClick(e: React.MouseEvent): void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'flex size-6 items-center justify-center rounded-md transition disabled:opacity-30 disabled:hover:bg-transparent',
        active
          ? 'bg-primary/10 text-primary'
          : danger
            ? 'text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive'
            : 'text-muted-foreground/60 hover:bg-primary/10 hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}

function adjustHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function PlayIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}
function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" /></svg>;
}
