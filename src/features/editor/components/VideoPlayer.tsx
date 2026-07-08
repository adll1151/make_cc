'use client';

import { forwardRef, type ReactNode } from 'react';

interface VideoPlayerProps {
  src: string | null;
  loading?: boolean;
  error?: string | null;
  /** 영상 위에 절대배치되는 오버레이 (예: 자막 미리보기) */
  overlay?: ReactNode;
  /** 지정된 대표 섬네일(포스터) URL (thumbnail-suggest m6) */
  poster?: string | null;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer({ src, loading, error, overlay, poster }, ref) {
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
            poster={poster ?? undefined}
            controls
            // crossOrigin=anonymous: 자막 스타일 어시(Tier 2) 프레임 샘플러가 같은 URL을
            // CORS-clean하게 재사용하려면 메인 로드도 CORS 요청이어야 캐시가 오염되지 않는다.
            // Supabase signed URL은 ACAO:*라 재생에 영향 없음(동일 오리진 데모도 무해).
            crossOrigin="anonymous"
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
