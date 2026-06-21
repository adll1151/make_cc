'use client';

import { useEffect, useState } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { speakerColor, speakerLabel } from '../lib/speaker-color';

/**
 * 화자 범례 + 이름 변경. 다화자(2명+)일 때만 표시.
 * 화자별 색상 점 + 이름 입력 → 변경 시 speaker_map 저장(PUT). 단일/미분리면 숨김.
 */
export function SpeakerLegend() {
  const jobId = useSubtitleStore((s) => s.jobId);
  const cues = useSubtitleStore((s) => s.cues);
  const speakerMap = useSubtitleStore((s) => s.speakerMap);
  const setSpeakerMap = useSubtitleStore((s) => s.setSpeakerMap);

  const speakerIds = [...new Set(cues.map((c) => c.speakerId).filter((s): s is string => !!s))].sort();
  if (speakerIds.length < 2) return null;

  async function save(id: string, name: string) {
    const next = { ...speakerMap, [id]: name.trim() };
    setSpeakerMap(next);
    if (!jobId) return;
    try {
      await fetch(`/api/subtitles/${jobId}/speakers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerMap: next }),
      });
    } catch {
      /* 로컬엔 반영됨 — 네트워크 실패는 무시 */
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        화자 {speakerIds.length}명
      </p>
      <div className="flex flex-wrap gap-2">
        {speakerIds.map((id) => (
          <SpeakerRow
            key={id}
            color={speakerColor(id).dot}
            initial={speakerMap[id] ?? speakerLabel(id, {})}
            onSave={(v) => save(id, v)}
          />
        ))}
      </div>
    </div>
  );
}

function SpeakerRow({
  color,
  initial,
  onSave,
}: {
  color: string;
  initial: string;
  onSave(name: string): void;
}) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 py-1 pl-2 pr-1">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && draft !== initial && onSave(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        maxLength={40}
        className="w-24 rounded-md bg-transparent px-1 text-sm outline-none focus:bg-background/60 focus:ring-1 focus:ring-primary/40"
        aria-label="화자 이름"
      />
    </span>
  );
}
