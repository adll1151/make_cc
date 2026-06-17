import Link from 'next/link';
import { UploadFlow } from '@/features/upload';
import { FloatingNav } from '@/components/ui/floating-nav';

export const metadata = {
  title: '영상 업로드 — make_cc',
  description: '영상을 업로드하면 한국어 자막(SRT)이 자동 생성됩니다.',
};

export default function UploadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-subtle" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />

      <section className="relative mx-auto max-w-3xl px-6 pb-16 pt-36 sm:pt-44">
        <div className="enter-stagger">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-card/40 px-3 py-1 text-xs font-medium backdrop-blur-xl">
              <span className="size-1.5 animate-pulse-glow rounded-full bg-accent" />
              <span className="text-muted-foreground">영상 업로드</span>
            </div>
          </div>

          <h1 className="text-display mt-6 text-4xl sm:text-5xl md:text-6xl">
            <span className="text-aurora">한국어 자막</span>
            <span className="text-gradient">을 만들 영상을</span>
            <br />
            <span className="text-gradient">올려주세요</span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-muted-foreground">
            업로드 후 SRT 자막이 자동 생성됩니다. 처리 중 화면을 떠나도 괜찮아요.
          </p>
        </div>

        <div className="enter-fade-up mt-12" style={{ animationDelay: '0.4s' }}>
          <UploadFlow />
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          업로드된 영상은 학습에 사용되지 않으며, 처리 후 자동 삭제됩니다. ·{' '}
          <Link href="/" className="underline-offset-2 hover:underline">
            처음으로
          </Link>
        </p>
      </section>
    </main>
  );
}
