'use client';

import { useRouter } from 'next/navigation';
import { ShimmerButton, type ShimmerButtonProps } from './shimmer-button';

/** ShimmerButton을 Next 라우팅 CTA로 사용(button-in-link 무효 회피). */
export function ShimmerLinkButton({
  href,
  children,
  ...rest
}: ShimmerButtonProps & { href: string }) {
  const router = useRouter();
  return (
    <ShimmerButton onClick={() => router.push(href)} {...rest}>
      {children}
    </ShimmerButton>
  );
}
