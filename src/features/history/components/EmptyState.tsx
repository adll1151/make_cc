import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  return (
    <div className="bento flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UploadIcon />
      </div>
      <div>
        <h3 className="text-xl font-bold tracking-tight">아직 영상이 없어요</h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          영상을 올리면 자동으로 한국어 자막을 만들어드려요.
        </p>
      </div>
      <Button asChild variant="gradient" size="lg">
        <Link href="/upload">첫 영상 올리기</Link>
      </Button>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
