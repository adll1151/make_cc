'use client';

import { useEffect, useRef } from 'react';
import { loadAclib } from './aclib';

/**
 * AdCash 배너 슬롯 (특정 위치에 배너 1개).
 * - `zoneId`(배너 존) prop이 있으면 aclib 로드 후 `runBanner`.
 * - 없으면 스타일된 플레이스홀더 (시안 유지 / 미설정 표시).
 *
 * ※ 페이지 자동 배치(AutoTag)는 `AdcashAutoTag` 컴포넌트를 사용.
 * ⚠️ AdCash는 등록 도메인에서만 서빙 → localhost 미서빙 가능 (배포 도메인 확인).
 */
export function AdSlot({
  zoneId,
  className,
  note,
}: {
  zoneId?: string;
  className?: string;
  note?: string;
}) {
  const id = zoneId || process.env.NEXT_PUBLIC_ADCASH_BANNER_ZONE_ID || '';
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!id || ran.current || !ref.current) return;
    ran.current = true;
    void loadAclib().then(() => {
      if (!ref.current) return;
      // embed 구조 재현: div 안에서 runBanner 실행 → 배너가 이 슬롯에 렌더
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.text = `try{aclib.runBanner({ zoneId: '${id}' });}catch(e){}`;
      ref.current.appendChild(s);
    });
  }, [id]);

  if (!id) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 p-6 text-center ${className ?? ''}`}
        aria-label="광고 영역 (배너 존 미설정)"
      >
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ad
        </span>
        <p className="text-sm text-muted-foreground">광고 영역 · Banner 존 미설정</p>
        {note && <p className="text-xs text-muted-foreground/60">{note}</p>}
      </div>
    );
  }

  return <div ref={ref} data-aci-zone={id} className={className} aria-label="advertisement" />;
}
