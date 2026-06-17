'use client';

import { forwardRef, type ReactNode } from 'react';

interface VideoPlayerProps {
  src: string | null;
  loading?: boolean;
  error?: string | null;
  /** 영상 위에 절대배치되는 오버레이 (예: 자막 미리보기) */
  overlay?: ReactNode;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer({ src, loading, error, overlay }, ref) {
    return (
      <div className="bento relative aspect-video w-full overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <div className="text-sm text-muted-foreground">영상 로딩 중...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 p-6 text-center backdrop-blur-sm">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {src && !error ? (
          <video
            ref={ref}
            src={src}
            controls
            className="size-full bg-black object-contain"
            preload="metadata"
            playsInline
          />
        ) : (
          !loading && !error && (
            <div className="flex size-full items-center justify-center bg-black/40 text-sm text-muted-foreground">
              영상 미리보기 불가
            </div>
          )
        )}
        {src && !error && overlay}
      </div>
    );
  },
);
