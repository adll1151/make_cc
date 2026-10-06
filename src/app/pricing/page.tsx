import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FloatingNav } from '@/components/ui/floating-nav';
import { PageBackground } from '@/components/PageBackground';
import { getPlanLimits } from '@/services/auth';

export const metadata: Metadata = {
  title: '요금제 — make_cc',
  description:
    'make_cc는 게스트·무료 회원으로 한국어 자막 생성·편집·번역·번인을 무료로 쓸 수 있습니다. 플랜별 영상 길이·용량·보관 기간 한도를 안내합니다.',
};

interface Plan {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string } | null;
  note?: string;
  highlight?: boolean;
}

export default function PricingPage() {
  const l = getPlanLimits();

  const plans: Plan[] = [
    {
      name: '게스트',
      price: '₩0',
      tagline: '가입 없이 바로 체험',
      features: [
        `영상 ${l.guest.duration} · ${l.guest.size}까지`,
        '자동 자막(SRT) 생성 · 리치 CC(♪음악♪·[웃음])',
        '브라우저 편집 · SRT 다운로드',
        '섬네일 추천 · 다운로드',
        `원본 영상 ${l.guest.retention} 후 자동 삭제`,
      ],
      cta: { label: '바로 업로드', href: '/upload' },
    },
    {
      name: '무료 회원',
      price: '₩0',
      tagline: '더 긴 영상 + 이력 보관',
      features: [
        `영상 ${l.member.duration} · ${l.member.size}까지`,
        '게스트 기능 전부 + 내 이력·편집 저장',
        `자막 번역 영상당 ${l.free.translateLangsPerJob}개 언어 (영·일·중)`,
        `번인 영상 ${l.free.burnInResolution}p · 워터마크 포함`,
        '섬네일을 대표 포스터로 저장',
        `원본 영상 ${l.member.retention} 보관 후 자동 삭제`,
      ],
      cta: { label: '무료로 가입', href: '/login' },
      highlight: true,
    },
    {
      name: 'Pro',
      price: '준비 중',
      tagline: '크리에이터·팀용',
      features: [
        '무료 회원 기능 전부',
        '자막 번역 언어 무제한',
        `번인 영상 ${l.pro.burnInResolution}p · 워터마크 없음`,
        '광고 없는 환경',
      ],
      cta: null,
      note: '결제 기능을 준비하고 있어요. 지금은 무료 플랜만 제공됩니다.',
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <PageBackground />
      <div className="grain-overlay" aria-hidden />
      <FloatingNav />

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-32 sm:pt-40">
        <h1 className="text-display text-center text-4xl sm:text-5xl">
          <span className="text-gradient">요금제</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-center text-muted-foreground">
          자막 생성·편집·번역·번인까지 지금은 모두 무료예요. 카드 등록도 필요 없습니다.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`bento flex flex-col p-6 ${p.highlight ? 'border-accent/50 ring-1 ring-accent/30' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight">{p.name}</h2>
                {p.highlight && (
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    추천
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-5 text-3xl font-bold tracking-tight">{p.price}</p>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5 text-accent" aria-hidden>
                      ✓
                    </span>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {p.note && <p className="mt-6 text-xs text-muted-foreground">{p.note}</p>}
              {p.cta && (
                <Button asChild variant={p.highlight ? 'gradient' : 'outline'} className="mt-6 w-full">
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          업로드한 영상은 학습에 사용되지 않습니다. 자세한 내용은{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            이용약관
          </Link>
          과{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            개인정보처리방침
          </Link>
          을 확인하세요.
        </p>
      </section>
    </main>
  );
}
