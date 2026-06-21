/**
 * 화자 id → 일관된 색상. 화자별로 cue 배지·범례에 같은 색을 쓴다.
 * spk_0, spk_1 … 의 숫자 인덱스로 팔레트를 순환(없으면 문자열 해시).
 */
const PALETTE: { dot: string; text: string }[] = [
  { dot: '#a78bfa', text: '#c4b5fd' }, // purple
  { dot: '#f472b6', text: '#f9a8d4' }, // pink
  { dot: '#fbbf24', text: '#fcd34d' }, // amber
  { dot: '#34d399', text: '#6ee7b7' }, // green
  { dot: '#60a5fa', text: '#93c5fd' }, // blue
  { dot: '#fb923c', text: '#fdba74' }, // orange
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function speakerColor(speakerId: string): { dot: string; text: string } {
  const m = /(\d+)$/.exec(speakerId);
  const idx = m ? Number(m[1]) : hashStr(speakerId);
  return PALETTE[idx % PALETTE.length]!;
}

/** 표시 이름: speakerMap에 있으면 그 이름, 없으면 spk_N → '화자 N+1' 기본값. */
export function speakerLabel(speakerId: string, speakerMap: Record<string, string>): string {
  if (speakerMap[speakerId]) return speakerMap[speakerId]!;
  const m = /(\d+)$/.exec(speakerId);
  return m ? `화자 ${Number(m[1]) + 1}` : speakerId;
}
