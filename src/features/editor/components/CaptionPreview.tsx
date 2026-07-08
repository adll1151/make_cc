'use client';

import type { CSSProperties } from 'react';
import { useSubtitleStore } from '../hooks/useSubtitleStore';
import { useCaptionStyle } from '../hooks/useCaptionStyle';

/**
 * 자막 스타일 미리보기 오버레이 (Design §5.3 — CSS 근사).
 *
 * 영상 위에 절대배치되어 현재 활성 cue를 선택된 스타일로 보여준다.
 * 정밀 픽셀 일치가 아니라 폰트·색·위치·외곽선·박스의 "느낌" 확인용.
 * 폰트 크기는 컨테이너 높이 대비(cqh)로 반응형 — 영상 높이 % 게이팅과 근사.
 * 카라오케는 단순 강조(전체 텍스트를 강조색)로 표시.
 */
export function CaptionPreview() {
  const style = useCaptionStyle((s) => s.style);
  const activeIndex = useSubtitleStore((s) => s.activeIndex);
  const cue = useSubtitleStore((s) =>
    activeIndex !== null ? s.cues[activeIndex] ?? null : null,
  );

  if (!cue) return null;

  const align =
    style.position === 'top'
      ? 'flex-start'
      : style.position === 'middle'
        ? 'center'
        : 'flex-end';

  // 리치 CC — 비음성 사운드 큐(♪음악♪·[웃음])는 번인과 동일하게 이탤릭·비카라오케 색으로.
  const isSound = cue.kind === 'sound';
  const textColor = !isSound && style.karaoke ? style.karaokeColor : style.color;

  const textStyle: CSSProperties = {
    fontFamily:
      style.fontFamily === 'NotoSansKR'
        ? "'Noto Sans KR', sans-serif"
        : "'Pretendard', sans-serif",
    fontSize: `${style.fontSizePct}cqh`,
    fontWeight: 700,
    fontStyle: isSound ? 'italic' : undefined,
    lineHeight: 1.25,
    color: textColor,
    whiteSpace: 'pre-line',
    textAlign: 'center',
    WebkitTextStroke:
      style.outlineWidth > 0 ? `${style.outlineWidth * 0.6}px ${style.outlineColor}` : undefined,
    paintOrder: 'stroke fill',
    ...(style.box
      ? {
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: '0.15em 0.5em',
          borderRadius: '0.2em',
        }
      : {}),
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] flex justify-center px-[6%] py-[5%]"
      style={{ alignItems: align, containerType: 'size' }}
      aria-hidden
    >
      <span style={textStyle}>{cue.text}</span>
    </div>
  );
}
