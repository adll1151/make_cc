import { BackgroundGradientAnimation } from '@/components/reactbits/BackgroundGradientAnimation';

/** 공통 꾸민 배경 — 랜딩과 같은 톤(Aceternity Background Gradient Animation). */
export function PageBackground({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-70" aria-hidden>
      <BackgroundGradientAnimation interactive={interactive} />
    </div>
  );
}
