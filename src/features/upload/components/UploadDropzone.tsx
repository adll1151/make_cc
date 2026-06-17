'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ALLOWED_VIDEO_EXTENSIONS } from '../lib/guest-caps';

/**
 * 영상 파일 드래그앤드롭 또는 클릭 선택.
 *
 * 모던 CSS:
 *   - @container (부모 폭에 따른 자동 반응형)
 *   - color-mix() (호버/드래그 상태 동적)
 *   - @starting-style (진입 애니메이션 — Chrome 117+)
 */
export function UploadDropzone({
  onFileSelected,
  disabled = false,
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFileSelected(files[0]!);
    },
    [onFileSelected],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };
  const onClick = () => {
    if (!disabled) inputRef.current?.click();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="@container">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="영상 파일을 드래그하거나 클릭하여 선택"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-dragging={isDragging || undefined}
        className={cn(
          'group/dropzone relative overflow-hidden',
          'flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed text-center',
          // 컨테이너 쿼리 기반 패딩
          'p-10 @md:p-14',
          // 트랜지션
          'transition-all duration-300 ease-[var(--ease-smooth)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // 상태별 스타일
          disabled
            ? 'cursor-not-allowed border-border bg-muted/30 opacity-60'
            : [
                'cursor-pointer bg-card/40 backdrop-blur-sm',
                // 평시
                'border-[color-mix(in_oklab,var(--color-border)_100%,transparent_0%)]',
                // hover
                'hover:bg-card/60',
                'hover:border-[color-mix(in_oklab,var(--color-primary)_40%,var(--color-border)_60%)]',
                // dragging (data attr 기반)
                'data-[dragging]:border-primary data-[dragging]:bg-primary/5',
                'data-[dragging]:scale-[1.01] data-[dragging]:shadow-[var(--shadow-glow)]',
              ],
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_VIDEO_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />

        {/* 배경 그라데이션 (dragging 시 활성) */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300',
            'bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklab,var(--color-primary)_15%,transparent_85%)_0%,transparent_70%)]',
            'group-data-[dragging]/dropzone:opacity-100',
          )}
        />

        {/* 아이콘 */}
        <div
          className={cn(
            'relative flex size-16 items-center justify-center rounded-2xl transition-all duration-300',
            'bg-[color-mix(in_oklab,var(--color-primary)_8%,var(--color-card)_92%)]',
            'text-primary',
            'group-hover/dropzone:scale-110 group-hover/dropzone:bg-[color-mix(in_oklab,var(--color-primary)_15%,var(--color-card)_85%)]',
            'group-data-[dragging]/dropzone:scale-125',
            'group-data-[dragging]/dropzone:animate-float',
          )}
        >
          <UploadIcon className="size-7" />
        </div>

        {/* 텍스트 */}
        <div className="relative space-y-1.5">
          <p className="text-lg font-semibold tracking-tight @md:text-xl">
            {isDragging ? (
              <span className="text-primary">여기에 놓으면 시작!</span>
            ) : (
              '영상 파일을 끌어다 놓으세요'
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            또는 <span className="font-semibold text-primary">클릭해서 선택</span>
          </p>
        </div>

        {/* 형식 안내 — 작은 칩 */}
        <div className="relative flex flex-wrap items-center justify-center gap-1.5">
          {['MP4', 'MOV', 'MKV', 'WebM'].map((ext) => (
            <span
              key={ext}
              className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-muted-foreground"
            >
              {ext}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
