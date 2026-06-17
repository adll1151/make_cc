'use client';

import { useEffect } from 'react';
import { loadAclib } from './aclib';

/**
 * AdCash AutoTag — 페이지에 광고 포맷을 자동 배치 (배너/네이티브/팝언더 등 zone 설정에 따름).
 * `NEXT_PUBLIC_ADCASH_ZONE_ID`(또는 zoneId prop) 없으면 no-op.
 *
 * ⚠️ AdCash는 등록 도메인에서만 서빙 → localhost에선 안 뜰 수 있음 (배포 도메인에서 확인).
 * 렌더 출력 없음 (스크립트만 실행).
 */
export function AdcashAutoTag({ zoneId }: { zoneId?: string }) {
  const id = zoneId || process.env.NEXT_PUBLIC_ADCASH_ZONE_ID || '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void loadAclib().then(() => {
      if (cancelled) return;
      try {
        window.aclib?.runAutoTag({ zoneId: id });
      } catch {
        /* noop */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return null;
}
