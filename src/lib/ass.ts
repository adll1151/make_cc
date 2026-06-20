/**
 * ASS(Advanced SubStation Alpha) 자막 빌더 — pure 함수.
 *
 * cue[] + CaptionStyle → ASS 문자열. ffmpeg `subtitles`/`ass` 필터로 영상에 번인.
 * 스타일(폰트·크기·색·외곽선·위치·박스) + 카라오케 단어 하이라이트(`\k`) 지원.
 * words 없으면 cue 단위 평문 fallback (카라오케 비활성).
 *
 * 참조: docs/02-design/features/burnin-captions.design.md §3.5 / §4
 */

import type { Cue } from '@/types/subtitle';
import type { CaptionFont, CaptionPosition, CaptionStyle } from '@/types/caption-style';

export interface AssResolution {
  playResX: number;
  playResY: number;
}

/**
 * CaptionFont 식별자 → fontconfig가 매칭하는 폰트 **내부 family명**.
 *
 * ASS `Style:`의 Fontname은 폰트 파일의 내부 family명과 정확히 일치해야 함.
 * Noto Sans KR의 내부 family명은 공백 포함 `Noto Sans KR`이므로 식별자
 * `NotoSansKR`를 그대로 쓰면 fontconfig가 못 찾아 tofu(□□□)로 렌더된다.
 * (브라우저 미리보기 CaptionPreview.tsx와 동일한 매핑.)
 */
const FONTCONFIG_FAMILY: Record<CaptionFont, string> = {
  Pretendard: 'Pretendard',
  NotoSansKR: 'Noto Sans KR',
};

export function assFontName(font: CaptionFont): string {
  return FONTCONFIG_FAMILY[font] ?? font;
}

/** `#RRGGBB` → ASS `&HBBGGRR&` (BGR 역순, 대문자). 잘못된 입력은 흰색. */
export function hexToAss(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m?.[1]) return '&HFFFFFF&';
  const d = m[1];
  const rr = d.slice(0, 2);
  const gg = d.slice(2, 4);
  const bb = d.slice(4, 6);
  return `&H${(bb + gg + rr).toUpperCase()}&`;
}

/** position → ASS numpad alignment (하단=2, 중앙=5, 상단=8). */
export function alignment(position: CaptionPosition): 2 | 5 | 8 {
  return position === 'top' ? 8 : position === 'middle' ? 5 : 2;
}

/** ms → ASS 시간 `H:MM:SS.cs` (centiseconds). */
export function assTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const cs = Math.floor((clamped % 1000) / 10);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

/** ASS 텍스트 이스케이프 — 중괄호(override 주입) 차단 + 줄바꿈 변환. */
export function escapeAssText(text: string): string {
  return text.replace(/\\/g, '∖').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fontSizePx(style: CaptionStyle, res: AssResolution): number {
  return Math.max(8, Math.round((res.playResY * style.fontSizePct) / 100));
}

function scriptInfo(res: AssResolution): string {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${res.playResX}`,
    `PlayResY: ${res.playResY}`,
    '',
  ].join('\n');
}

function stylesSection(style: CaptionStyle, res: AssResolution): string {
  const size = fontSizePx(style, res);
  const align = alignment(style.position);
  const borderStyle = style.box ? 3 : 1; // 3=opaque box, 1=outline+shadow
  // 카라오케: 텍스트는 SecondaryColour로 시작 → \k 진행 시 PrimaryColour로.
  // PrimaryColour=하이라이트, SecondaryColour=기본색. 비카라오케면 둘 다 기본색.
  const primary = style.karaoke ? hexToAss(style.karaokeColor) : hexToAss(style.color);
  const secondary = hexToAss(style.color);
  const outline = hexToAss(style.outlineColor);
  const back = '&H80000000&'; // 반투명 검정 (box 배경/그림자)
  const marginV = Math.round(res.playResY * 0.06);
  const format =
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';
  const styleLine = `Style: Default,${assFontName(style.fontFamily)},${size},${primary},${secondary},${outline},${back},-1,0,0,0,100,100,0,0,${borderStyle},${style.outlineWidth},0,${align},40,40,${marginV},1`;
  return ['[V4+ Styles]', format, styleLine, ''].join('\n');
}

function dialogueText(cue: Cue, style: CaptionStyle): string {
  if (style.karaoke && cue.words && cue.words.length > 0) {
    return cue.words
      .map((w) => {
        const cs = Math.max(1, Math.round((w.endMs - w.startMs) / 10));
        return `{\\k${cs}}${escapeAssText(w.text)}`;
      })
      .join(' ');
  }
  return escapeAssText(cue.text);
}

function dialogueLine(cue: Cue, style: CaptionStyle): string {
  return `Dialogue: 0,${assTime(cue.startMs)},${assTime(cue.endMs)},Default,,0,0,0,,${dialogueText(cue, style)}`;
}

/** cue[] + 스타일 → ASS 문자열. */
export function buildAss(cues: Cue[], style: CaptionStyle, res: AssResolution): string {
  // ASS 스펙: Events Format은 반드시 `Text`로 끝나야 함. 누락 시 libass가
  // 이벤트는 파싱하되 본문을 매핑 못해 빈 자막으로 렌더(빈 화면). PoC에서 확인.
  const events = ['[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
  for (const cue of cues) events.push(dialogueLine(cue, style));
  return [scriptInfo(res), stylesSection(style, res), events.join('\n'), ''].join('\n');
}
