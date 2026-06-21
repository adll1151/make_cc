'use client';

import { useEffect, useRef } from 'react';

/**
 * Google AdSense 광고 유닛 (특정 위치에 디스플레이 광고 1개).
 * - `NEXT_PUBLIC_ADSENSE_CLIENT`(ca-pub-…) + `slot`(또는 `NEXT_PUBLIC_ADSENSE_SLOT`)이 있으면
 *   adsbygoogle 로드 후 광고를 렌더.
 * - 없으면 스타일된 플레이스홀더 (시안 유지 / 미설정 표시).
 *
 * ⚠️ AdSense는 승인된 사이트에서만 서빙 → localhost에선 안 뜰 수 있음 (배포 도메인에서 확인).
 */
export function AdSlot({
  slot,
  className,
  note,
}: {
  slot?: string;
  className?: string;
  note?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';
  const slotId = slot || process.env.NEXT_PUBLIC_ADSENSE_SLOT || '';
  const ran = useRef(false);

  useEffect(() => {
    if (!client || !slotId || ran.current) return;
    ran.current = true;
    // 스크립트는 콘텐츠 페이지의 <AdsenseScript />가 로드한다. 여기선 push만 —
    // 스크립트가 아직 안 떴어도 adsbygoogle 큐에 쌓였다가 로드 시 처리됨(AdSense 표준).
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop */
    }
  }, [client, slotId]);

  if (!client || !slotId) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 p-6 text-center ${className ?? ''}`}
        aria-label="광고 영역 (AdSense 미설정)"
      >
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ad
        </span>
        <p className="text-sm text-muted-foreground">광고 영역 · AdSense 미설정</p>
        {note && <p className="text-xs text-muted-foreground/60">{note}</p>}
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
      aria-label="advertisement"
    />
  );
}
