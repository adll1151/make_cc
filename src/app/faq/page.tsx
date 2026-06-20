import type { Metadata } from 'next';
import Link from 'next/link';
import { FloatingNav } from '@/components/ui/floating-nav';
import { AdSlot } from '@/components/ads/AdSlot';

export const metadata: Metadata = {
  title: '자주 묻는 질문(FAQ) — make_cc',
  description:
    '요금, 지원 포맷, 자막 정확도, 처리 시간, 영상 보안, 편집·번인·공유 등 make_cc에 대해 자주 묻는 질문과 답변을 모았습니다.',
};

const CONTACT_EMAIL = 'shong7500@gmail.com';

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: '무료로 쓸 수 있나요?',
    a: (
      <>
        네. 회원가입 없이 게스트로 무료 체험할 수 있습니다. 더 긴 영상, 더 많은 처리량, 광고 없는
        환경, 번인 영상의 워터마크 제거·고화질(1080p) 출력이 필요하면 Pro 플랜을 이용하시면 됩니다.
      </>
    ),
  },
  {
    q: '어떤 영상·음성 포맷을 지원하나요?',
    a: (
      <>
        MP4, MOV, MKV, WebM 등 일반적인 영상 포맷과 음성 파일을 폭넓게 지원합니다. 내부적으로 음성
        트랙을 추출해 인식하므로, 화질보다 <strong className="text-foreground">음성이 또렷한지</strong>가
        결과 품질에 더 중요합니다.
      </>
    ),
  },
  {
    q: '자막 정확도는 어느 정도인가요?',
    a: (
      <>
        self-hosted Whisper(large-v3) 한국어 모델을 사용하며, 또렷한 음성 기준 단어 오류율(WER)은 대체로
        15% 안팎입니다. 다만 잡음이 많거나 발음이 뭉개지면 오차가 커질 수 있어, 고유명사·전문 용어가
        많은 영상은 편집기에서 한 번 다듬는 것을 권장합니다.
      </>
    ),
  },
  {
    q: '처리 시간은 얼마나 걸리나요?',
    a: <>5분 분량 영상은 평균 3분 안팎입니다. 영상 길이와 대기 중인 작업량에 따라 달라질 수 있습니다.</>,
  },
  {
    q: '제가 올린 영상은 안전한가요?',
    a: (
      <>
        업로드한 원본 영상·음성은 자막 생성을 위해서만 일시적으로 처리되며,{' '}
        <strong className="text-foreground">학습에 사용되지 않습니다.</strong> 처리가 끝나면 원본은
        자동 삭제됩니다(게스트 즉시, 회원 보관 기간 경과 후). 자세한 내용은{' '}
        <Link href="/privacy" className="text-primary underline underline-offset-2">
          개인정보처리방침
        </Link>
        을 확인하세요.
      </>
    ),
  },
  {
    q: '자막을 직접 수정할 수 있나요?',
    a: (
      <>
        네. 자막이 생성되면 브라우저 편집기에서 영상을 보며 라인 단위로 텍스트를 고칠 수 있습니다.
        오타·띄어쓰기·타이밍을 손쉽게 다듬을 수 있어요.
      </>
    ),
  },
  {
    q: '영상에 자막을 입히는 것(번인)도 되나요?',
    a: (
      <>
        됩니다. 번인 자막 스튜디오에서 폰트·색·외곽선·위치·화면 비율(원본/9:16/1:1)을 골라 자막이 박힌
        새 영상(MP4)을 만들 수 있습니다. 쇼츠·릴스처럼 자막이 항상 보여야 하는 영상에 적합합니다.
      </>
    ),
  },
  {
    q: '자막 파일은 어떤 형식인가요?',
    a: (
      <>
        표준 <strong className="text-foreground">SRT</strong> 형식으로 제공됩니다. 유튜브, 프리미어,
        다빈치 리졸브, 캡컷 등 대부분의 플랫폼·편집 프로그램에서 바로 불러올 수 있습니다.
      </>
    ),
  },
  {
    q: '만든 자막을 다른 사람과 공유할 수 있나요?',
    a: <>회원은 공유 링크를 생성할 수 있고, 링크를 받은 사람은 로그인 없이 자막을 다운로드할 수 있습니다.</>,
  },
  {
    q: '한국어 외 다른 언어도 지원하나요?',
    a: (
      <>
        현재는 한국어 음성 인식에 최적화돼 있습니다. 다국어 자막과 번역은 추후 업데이트로 검토하고
        있습니다.
      </>
    ),
  },
  {
    q: '문의는 어디로 하나요?',
    a: (
      <>
        궁금한 점이나 오류 제보는{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
        로 보내주세요. 최대한 빠르게 답변드리겠습니다.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-40">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
        <h1 className="text-display mt-3 text-4xl sm:text-5xl">
          <span className="text-gradient">자주 묻는 질문</span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          make_cc를 쓰면서 가장 많이 묻는 질문들을 모았습니다. 여기서 답을 찾지 못했다면 언제든
          이메일로 문의해 주세요.
        </p>

        <div className="mt-10 space-y-4">
          {FAQS.map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border/60 bg-card/30 p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-semibold text-foreground">
                {item.q}
                <span className="shrink-0 text-muted-foreground transition group-open:rotate-45">＋</span>
              </summary>
              <div className="mt-3 leading-relaxed text-muted-foreground">{item.a}</div>
            </details>
          ))}
        </div>

        <section className="mt-12">
          <AdSlot className="min-h-[120px]" note="스폰서 광고" />
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-border/60 pt-8 text-sm">
          <Link
            href="/upload"
            className="rounded-full bg-foreground px-5 py-2 font-semibold text-background transition hover:opacity-90"
          >
            지금 영상 올려보기 →
          </Link>
          <Link href="/guide" className="text-muted-foreground transition hover:text-foreground">
            사용법 가이드 보기
          </Link>
          <Link href="/" className="text-muted-foreground transition hover:text-foreground">
            홈으로
          </Link>
        </div>
      </article>
    </main>
  );
}
