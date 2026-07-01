'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

/**
 * 라우트 변경마다 page_view 를 남기는 전역 트래커. 렌더 출력 없음.
 * app/layout.tsx 에 1회 마운트한다.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track('page_view', { path: pathname });
  }, [pathname]);
  return null;
}
