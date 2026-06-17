'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { AdSlot } from '@/components/ads/AdSlot';

/**
 * /test — 디자인·기능 프리뷰 샌드박스.
 * 실제 라우트/네비에 연결 안 함. 여기서 시안을 보고 피드백 → 확정되면 실제 페이지로 이관.
 *
 * 현재 시안: 수익화 UI (요금제 카드 + 업그레이드 CTA + 광고 슬롯 예시)
 */

type Cycle = 'monthly' | 'yearly';

interface Plan {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  cta: string;
  highlight: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: '무료',
    tagline: '가볍게 시작',
    monthly: 0,
    yearly: 0,
    cta: '현재 플랜',
    highlight: false,
    features: ['월 30분 처리', '영상당 최대 5분', 'SRT 다운로드', '표준 처리 속도', '공유 링크 3개'],
  },
  {
    name: 'Pro',
    tagline: '크리에이터용',
    monthly: 9900,
    yearly: 99000,
    cta: 'Pro 시작하기',
    highlight: true,
    features: [
      '월 600분 처리',
      '영상당 최대 60분',
      '화자 분리 (speaker)',
      '우선 처리 (빠름)',
      '공유 무제한',
      '광고 없음',
    ],
  },
  {
    name: 'Team',
    tagline: '팀 · 비즈니스',
    monthly: 29000,
    yearly: 290000,
    cta: '문의하기',
    highlight: false,
    features: ['월 3,000분 처리', '멤버 5인', 'API 액세스', '우선 지원', '맞춤 보관 정책'],
  },
];

const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function TestPage() {
  const [cycle, setCycle] = useState<Cycle>('monthly');

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <FloatingNav />

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-32 sm:pt-36">
        <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-card/40 px-4 py-1.5 text-sm backdrop-blur-xl">
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
            TEST
          </span>
          <span className="text-muted-foreground">디자인·기능 프리뷰 — 피드백용 (실제 반영 전)</span>
        </div>

        {/* ============ 예시 C — 처리 중 광고 (지금 우선) ============ */}
        <section className="mb-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            ★ 예시 C — 처리 대기 광고 (지금 우선 검토 / ads-first)
          </p>
          <div className="mx-auto max-w-xl bento p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">자막 생성 중…</p>
                <p className="mt-1 text-sm text-muted-foreground">my-video.mp4 · 음성 인식</p>
              </div>
              <span className="text-display text-2xl text-aurora">64%</span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-[var(--aurora-purple)] to-[var(--aurora-magenta)]" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">예상 1분 남음 — 기다리는 동안:</p>

            <AdSlot className="mt-4 min-h-[120px]" note="처리 대기 배너 · AdCash · Pro는 숨김" />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground/60">
            * 대기 시간은 어차피 비는 시간 → 가장 덜 거슬리는 광고 지점. 팝업·전면광고는 배제, 배너/네이티브만.
          </p>
        </section>

        {/* ============ 요금제 (나중 단계) ============ */}
        <section className="mb-24">
          <header className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
              Pricing · 나중 단계 (기능 더 쌓인 뒤)
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-gradient">필요한 만큼만</span> 쓰세요
            </h1>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              구독은 기능이 충분해진 뒤 도입 — 지금은 참고용 시안. (현 우선순위는 위 ★ 처리 대기 광고)
            </p>

            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card/40 p-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setCycle('monthly')}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  cycle === 'monthly' ? 'bg-foreground text-background' : 'text-muted-foreground'
                }`}
              >
                월간
              </button>
              <button
                type="button"
                onClick={() => setCycle('yearly')}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  cycle === 'yearly' ? 'bg-foreground text-background' : 'text-muted-foreground'
                }`}
              >
                연간 <span className="text-accent">2개월 무료</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const price = cycle === 'monthly' ? plan.monthly : plan.yearly;
              const perMonth =
                cycle === 'yearly' && plan.yearly > 0 ? Math.round(plan.yearly / 12) : null;
              return (
                <article
                  key={plan.name}
                  className={`bento relative flex flex-col p-7 ${
                    plan.highlight ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--aurora-purple)] to-[var(--aurora-magenta)] px-3 py-1 text-[11px] font-bold text-white">
                      가장 인기
                    </span>
                  )}
                  <h3 className="text-lg font-bold tracking-tight">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

                  <div className="mt-5">
                    {price === 0 ? (
                      <p className="text-display text-4xl">₩0</p>
                    ) : (
                      <>
                        <p className="text-display text-4xl">
                          {won(price)}
                          <span className="text-base font-normal text-muted-foreground">
                            {cycle === 'monthly' ? ' /월' : ' /년'}
                          </span>
                        </p>
                        {perMonth && (
                          <p className="mt-1 text-xs text-muted-foreground">월 {won(perMonth)} 꼴</p>
                        )}
                      </>
                    )}
                  </div>

                  <Button
                    variant={plan.highlight ? 'gradient' : 'outline'}
                    size="lg"
                    className="mt-6 w-full"
                    disabled={plan.name === '무료'}
                  >
                    {plan.cta}
                  </Button>

                  <ul className="mt-6 space-y-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckIcon />
                        <span
                          className={
                            f === '광고 없음' ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          }
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground/60">
            * 가격·분량은 예시입니다. 결제 연동(Toss/Stripe) 전 시안.
          </p>
        </section>

        {/* ============ 업그레이드 CTA 배너 ============ */}
        <section className="mb-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            예시 A — 캡 도달 시 업그레이드 유도 배너
          </p>
          <div className="bento aurora-subtle flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">이번 달 무료 처리량(30분)을 다 썼어요</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pro로 업그레이드하면 월 600분 + 긴 영상 + 화자 분리까지.
              </p>
            </div>
            <Button variant="gradient" size="lg" className="shrink-0">
              Pro 업그레이드
            </Button>
          </div>
        </section>

        {/* ============ 광고 슬롯 예시 ============ */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            예시 B — 무료 티어 광고 슬롯 (Photopea식, 보조 수익 / 선택)
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="bento flex min-h-[220px] items-center justify-center p-6 text-sm text-muted-foreground">
              (메인 콘텐츠 영역 — 예: 이력/결과 페이지)
            </div>
            <AdSlot className="min-h-[220px]" note="무료 티어 전용 · 300×250 · Pro는 광고 없음" />
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground/60">
            * 광고는 업로드·편집기 등 핵심 흐름엔 넣지 않고, 비핵심 페이지에만. 넣을지 여부는 피드백으로 결정.
          </p>
        </section>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="mt-0.5 shrink-0 text-success"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
