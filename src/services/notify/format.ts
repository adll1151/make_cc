/**
 * Discord DM embed 생성 (pure 함수).
 *
 * ⚠️ 자막 원문·cue 텍스트는 절대 포함하지 않는다 (Design N-06 / §4.4).
 *    영상 컨텐츠 프라이버시 — 제목 + 다운로드/편집 링크만 전달.
 */

import { env } from '@/lib/env';
import type { DiscordMessage } from './discord';

const COLOR_SUCCESS = 0x57f287; // discord green
const COLOR_FAIL = 0xed4245; // discord red

const MAX_NAME = 100;
const MAX_REASON = 200;

export interface CompletedMessageInput {
  videoOriginalName: string;
  jobId: string;
}

export function toDiscordCompletedMessage(input: CompletedMessageInput): DiscordMessage {
  const editor = `${env.NEXT_PUBLIC_APP_URL}/editor/${input.jobId}`;
  const download = `${env.NEXT_PUBLIC_APP_URL}/api/subtitles/${input.jobId}/download`;
  return {
    embed: {
      title: '✅ 자막 생성 완료',
      description: `**${truncate(input.videoOriginalName, MAX_NAME)}** 자막이 준비됐어요.`,
      color: COLOR_SUCCESS,
      fields: [
        { name: '미리보기 / 편집', value: editor },
        { name: 'SRT 다운로드', value: download },
      ],
      footer: { text: 'make_cc' },
    },
  };
}

export interface FailedMessageInput {
  videoOriginalName: string;
  errorMessage: string;
  jobId: string;
}

export function toDiscordFailedMessage(input: FailedMessageInput): DiscordMessage {
  const retry = `${env.NEXT_PUBLIC_APP_URL}/editor/${input.jobId}`;
  return {
    embed: {
      title: '⚠️ 자막 생성 실패',
      description: `**${truncate(input.videoOriginalName, MAX_NAME)}** 처리 중 문제가 생겼어요.`,
      color: COLOR_FAIL,
      fields: [
        { name: '사유', value: truncate(input.errorMessage, MAX_REASON) },
        { name: '다시 시도', value: retry },
      ],
      footer: { text: 'make_cc' },
    },
  };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
