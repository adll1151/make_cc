'use client';

import { useEffect, useRef } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { CueItem } from './CueItem';

interface CueListProps {
  onSeek(startMs: number): void;
}

export function CueList({ onSeek }: CueListProps) {
  const cues = useSubtitleStore((s) => s.cues);
  const activeIndex = useSubtitleStore((s) => s.activeIndex);
  const containerRef = useRef<HTMLUListElement>(null);

  // 활성 cue로 자동 스크롤 — DOM 셀렉터로 찾기 (ref 전달 복잡도 회피)
  useEffect(() => {
    if (activeIndex === null) return;
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLLIElement>('[data-active]');
    if (!activeEl) return;
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  if (cues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
        <span>자막이 비어있습니다.</span>
      </div>
    );
  }

  return (
    <ul ref={containerRef} className="space-y-2">
      {cues.map((cue, idx) => (
        <CueItem
          key={cue.index}
          cue={cue}
          isActive={activeIndex === idx}
          onSeek={onSeek}
        />
      ))}
    </ul>
  );
}
