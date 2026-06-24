'use client';

import { useEffect, useRef } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { CueItem } from './CueItem';

interface CueListProps {
  onSeek(startMs: number): void;
  onPlayCue(startMs: number, endMs: number): void;
  getCurrentMs(): number;
}

const MIN_GAP_MS = 200;

export function CueList({ onSeek, onPlayCue, getCurrentMs }: CueListProps) {
  const cues = useSubtitleStore((s) => s.cues);
  const activeIndex = useSubtitleStore((s) => s.activeIndex);
  const selectedIndex = useSubtitleStore((s) => s.selectedIndex);
  const editingIndex = useSubtitleStore((s) => s.editingIndex);
  const addCueAfter = useSubtitleStore((s) => s.addCueAfter);
  const containerRef = useRef<HTMLUListElement>(null);

  // 키보드 내비게이션: ↑/↓ 선택 이동(+seek), Enter 편집. 편집 중/입력 포커스면 무시.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useSubtitleStore.getState();
      if (st.editingIndex !== null) return; // 편집 중엔 textarea가 처리
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const list = st.cues;
      if (list.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const base = st.selectedIndex ?? st.activeIndex ?? -1;
        const next =
          e.key === 'ArrowDown'
            ? Math.min(base + 1, list.length - 1)
            : Math.max(base <= 0 ? 0 : base - 1, 0);
        st.setSelectedIndex(next);
        onSeek(list[next]!.startMs);
      } else if (e.key === 'Enter') {
        if (st.selectedIndex !== null) {
          e.preventDefault();
          st.setEditingIndex(st.selectedIndex);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSeek]);

  // 선택 cue로 스크롤 (키보드/클릭 내비게이션)
  useEffect(() => {
    if (selectedIndex === null) return;
    const el = containerRef.current?.querySelector<HTMLLIElement>('[data-selected]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIndex]);

  // 재생 위치 따라가기 — 단, 편집 중이거나 사용자가 cue를 선택한 상태면 끌고가지 않음
  useEffect(() => {
    if (activeIndex === null) return;
    if (editingIndex !== null || selectedIndex !== null) return;
    const el = containerRef.current?.querySelector<HTMLLIElement>('[data-active]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex, editingIndex, selectedIndex]);

  if (cues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
        <span>자막이 비어있습니다.</span>
      </div>
    );
  }

  const lastCue = cues[cues.length - 1];

  return (
    <>
      <ul ref={containerRef} className="space-y-2">
        {cues.map((cue, idx) => {
          const next = cues[idx + 1];
          const canAddAfter = !next || next.startMs - cue.endMs >= MIN_GAP_MS;
          return (
            <CueItem
              key={cue.index}
              cue={cue}
              idx={idx}
              isActive={activeIndex === idx}
              isSelected={selectedIndex === idx}
              canAddAfter={canAddAfter}
              onSeek={onSeek}
              onPlayCue={onPlayCue}
              getCurrentMs={getCurrentMs}
            />
          );
        })}
      </ul>
      {lastCue && (
        <button
          type="button"
          onClick={() => addCueAfter(lastCue.index)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <span className="text-base leading-none">＋</span> 자막 추가
        </button>
      )}
    </>
  );
}
