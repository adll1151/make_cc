'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { CountUp } from '@/components/reactbits/CountUp';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { BlurText } from '@/components/reactbits/BlurText';
import { SpotlightCard } from '@/components/reactbits/SpotlightCard';
import type { FunnelKpi, FunnelSummary } from '@/types/analytics';

const RANGES = [7, 30, 90];

export function AdminAnalyticsView({ data }: { data: FunnelSummary }) {
  const empty = data.totalEvents === 0;

  return (
    <main className="relative min-h-screen">
      <section className="mx-auto max-w-5xl px-6 pb-28 pt-32 sm:pt-36">
        {/* 헤더 */}
        <div className="scroll-fade mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <MonoLabel>
              <ShinyText text="Operator · Analytics" />
            </MonoLabel>
            <h1 className="mt-2.5 text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
              <BlurText text="운영 분석" />
            </h1>
            <p className="mt-2.5 text-sm text-muted-foreground">
              최근 {data.sinceDays}일 · 이전 동일 기간 대비 증감
            </p>
          </div>
          <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin/analytics?days=${r}`}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs tracking-wider transition ${
                  r === data.sinceDays ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}D
              </Link>
            ))}
          </nav>
        </div>

        {empty ? (
          <EmptyPanel />
        ) : (
          <div className="space-y-16">
            {/* ── KPI 행 (Δ 포함) ── */}
            <div className="scroll-fade">
              <MonoLabel live>{'// LIVE METRICS'}</MonoLabel>
              <div className="relative mt-3">
                <HudCorners />
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
                  {data.kpis.map((k) => (
                    <KpiCell key={k.key} kpi={k} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── 퍼널 (히어로) ── */}
            <div className="scroll-fade">
              <SectionHead eyebrow="Conversion Funnel" title="전환 퍼널" />
              <div className="relative">
                <HudCorners />
                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-9">
                  <div className="space-y-0">
                    {data.steps.map((s, i) => (
                      <FunnelRow key={s.event} step={s} index={i} isLast={i === data.steps.length - 1} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 브레이크다운 (Plausible 스타일 바-리스트) ── */}
            <div className="scroll-fade">
              <SectionHead eyebrow="Breakdown" title="유입과 페이지" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BreakdownCard title="유입 경로" rows={data.referrers.map((r) => [r.name, r.count])} />
                <BreakdownCard title="인기 페이지" rows={data.paths.map((p) => [p.path, p.count])} />
              </div>
            </div>
          </div>
        )}

        <p className="mt-14 text-right font-mono text-[11px] tracking-wider text-muted-foreground/50">
          {'// generated '}
          {new Date(data.generatedAt).toLocaleString('ko-KR')}
        </p>
      </section>
    </main>
  );
}

/* ===================== KPI ===================== */

function KpiCell({ kpi }: { kpi: FunnelKpi }) {
  return (
    <div className="bg-card p-6 sm:p-7">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kpi.label}</p>
      <p className="mt-2.5 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
        <CountUp to={kpi.value} suffix={kpi.suffix} />
      </p>
      <Delta delta={kpi.delta} suffix={kpi.deltaSuffix} />
    </div>
  );
}

function Delta({ delta, suffix }: { delta: number | null; suffix: string }) {
  if (delta == null) {
    return <p className="mt-2 font-mono text-[11px] text-muted-foreground/50">— 이전 데이터 없음</p>;
  }
  const up = delta >= 0;
  return (
    <p className={`mt-2 flex items-center gap-1 font-mono text-[11px] ${up ? 'text-success' : 'text-muted-foreground'}`}>
      <span>{up ? '▲' : '▼'}</span>
      <span className="font-semibold">
        {Math.abs(delta)}
        {suffix}
      </span>
      <span className="text-muted-foreground/50">vs 이전</span>
    </p>
  );
}

/* ===================== 퍼널 ===================== */

function FunnelRow({
  step,
  index,
  isLast,
}: {
  step: FunnelSummary['steps'][number];
  index: number;
  isLast: boolean;
}) {
  return (
    <div>
      {/* 단계 사이 전환/이탈 커넥터 */}
      {index > 0 && step.stepConv != null && (
        <div className="flex items-center gap-2.5 py-2 pl-1 text-[11px] font-mono text-muted-foreground/60">
          <span className="h-4 w-px bg-border-strong" />
          <span>
            <span className="text-foreground/70">{step.stepConv}%</span> 전환
            <span className="mx-1.5 text-muted-foreground/30">·</span>
            {(Math.round((100 - step.stepConv) * 10) / 10).toFixed(1)}% 이탈
          </span>
        </div>
      )}
      {/* 단계 바 */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold tracking-tight">
            <span className="mr-2 font-mono text-xs text-muted-foreground/50">{String(index + 1).padStart(2, '0')}</span>
            {step.label}
          </span>
          <span className="flex items-baseline gap-2 font-mono text-xs text-muted-foreground">
            <CountUp to={step.sessions} className="text-base font-bold text-foreground" delay={0.15 + index * 0.06} />
            <span className="text-foreground/70">{step.pctOfTop}%</span>
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-md bg-muted">
          <motion.div
            className="h-full rounded-md bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(step.pctOfTop, step.sessions > 0 ? 1.5 : 0)}%` }}
            transition={{ duration: 0.9, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      {!isLast && <div className="h-4" />}
    </div>
  );
}

/* ===================== 브레이크다운 ===================== */

function BreakdownCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <SpotlightCard className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
      <CardHud />
      <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(([label, count], i) => (
            // Plausible 스타일: 행 배경이 비율 바
            <li key={label} className="relative flex items-center justify-between overflow-hidden rounded-md px-2.5 py-1.5 text-sm">
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-md bg-accent/10"
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.7, delay: 0.06 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className="relative truncate text-foreground/80">{label}</span>
              <span className="relative font-mono text-xs font-semibold tabular-nums">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </SpotlightCard>
  );
}

/* ===================== 공통 (랜딩 패턴) ===================== */

function EmptyPanel() {
  return (
    <div className="relative">
      <HudCorners />
      <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-[var(--shadow-card)]">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">{'// NO DATA'}</p>
        <p className="mt-4 text-lg font-bold tracking-tight">아직 수집된 데이터가 없습니다.</p>
        <p className="mt-2 text-sm text-muted-foreground">실사용자가 사이트를 방문하면 여기에 퍼널이 채워집니다.</p>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <MonoLabel>
        <ShinyText text={eyebrow} />
      </MonoLabel>
      <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{title}</h2>
    </div>
  );
}

function MonoLabel({ children, live = false }: { children: React.ReactNode; live?: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
      <span className={`size-1.5 rounded-full bg-accent ${live ? 'animate-pulse-glow' : ''}`} />
      {children}
    </p>
  );
}

function HudCorners() {
  const base = 'pointer-events-none absolute size-3 border-border-strong';
  return (
    <span aria-hidden>
      <span className={`${base} -left-1.5 -top-1.5 border-l border-t`} />
      <span className={`${base} -right-1.5 -top-1.5 border-r border-t`} />
      <span className={`${base} -bottom-1.5 -left-1.5 border-b border-l`} />
      <span className={`${base} -bottom-1.5 -right-1.5 border-b border-r`} />
    </span>
  );
}

function CardHud() {
  const base =
    'pointer-events-none absolute size-3 border-accent/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100';
  return (
    <span aria-hidden>
      <span className={`${base} left-2 top-2 border-l border-t`} />
      <span className={`${base} right-2 top-2 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </span>
  );
}
