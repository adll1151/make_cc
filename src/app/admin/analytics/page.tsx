import { notFound } from 'next/navigation';
import { FloatingNav } from '@/components/ui/floating-nav';
import { getAdminContext } from '@/services/auth';
import { getFunnelSummary } from '@/services/analytics';
import { AdminAnalyticsView } from '@/features/analytics/AdminAnalyticsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '운영 분석 — make_cc', robots: { index: false, follow: false } };

const RANGES = [7, 30, 90];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // 운영자(ADMIN_EMAILS)만 — 아니면 존재 자체를 숨김
  const admin = await getAdminContext();
  if (!admin) notFound();

  const { days } = await searchParams;
  const sinceDays = RANGES.includes(Number(days)) ? Number(days) : 30;
  const data = await getFunnelSummary({ sinceDays });

  return (
    <>
      <FloatingNav />
      <AdminAnalyticsView data={data} />
    </>
  );
}
