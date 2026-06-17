/**
 * 이메일 템플릿 — 최소 HTML/텍스트 페어.
 *
 * Resend는 HTML + text 모두 전송 (HTML 미지원 클라이언트 대비).
 * 사용자 입력은 escapeHtml로 안전 처리.
 */

import { env } from '@/lib/env';

export interface JobCompletedTemplateInput {
  videoOriginalName: string;
  durationSec: number;
  cueCount: number;
  jobId: string;
}

export function jobCompletedTemplate(input: JobCompletedTemplateInput) {
  const link = `${env.NEXT_PUBLIC_APP_URL}/editor/${input.jobId}`;
  const downloadLink = `${env.NEXT_PUBLIC_APP_URL}/api/subtitles/${input.jobId}/download`;
  const safeName = escapeHtml(input.videoOriginalName);
  const minutes = Math.round(input.durationSec / 60);

  return {
    subject: `[make_cc] 자막 생성 완료 — ${input.videoOriginalName}`,
    html: `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#a060ff,#ff5fb5);color:#fff;font-weight:700;font-size:11px;padding:4px 10px;border-radius:6px;letter-spacing:1px;">SRT</div>
    <h1 style="font-size:24px;margin:20px 0 8px;color:#fff;">자막이 준비됐어요</h1>
    <p style="margin:0 0 24px;color:#9a9a9a;line-height:1.6;">
      <strong style="color:#fff;">${safeName}</strong>의 한국어 자막(SRT)을 만들었습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
      <tr><td style="padding:8px 0;color:#7a7a7a;">영상 길이</td><td style="padding:8px 0;color:#fff;text-align:right;">${minutes}분 ${input.durationSec % 60}초</td></tr>
      <tr><td style="padding:8px 0;color:#7a7a7a;border-top:1px solid #2a2a2a;">자막 cue 수</td><td style="padding:8px 0;color:#fff;text-align:right;border-top:1px solid #2a2a2a;">${input.cueCount}개</td></tr>
    </table>
    <div style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#a060ff,#ff5fb5);color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;">미리보기 / 편집</a>
      <a href="${downloadLink}" style="display:inline-block;margin-left:8px;color:#fff;text-decoration:none;padding:12px 24px;border:1px solid #2a2a2a;border-radius:12px;font-weight:600;">SRT 다운로드</a>
    </div>
    <p style="margin:24px 0 0;color:#666;font-size:12px;line-height:1.6;">
      업로드된 영상은 학습에 사용되지 않으며, 30일 후 자동 삭제됩니다.<br>
      이 메일은 make_cc에서 보낸 자동 알림입니다.
    </p>
  </div>
</body>
</html>`,
    text: [
      `자막이 준비됐어요`,
      ``,
      `${input.videoOriginalName}의 한국어 자막(SRT)을 만들었습니다.`,
      ``,
      `영상 길이: ${minutes}분 ${input.durationSec % 60}초`,
      `자막 cue 수: ${input.cueCount}개`,
      ``,
      `미리보기 / 편집: ${link}`,
      `SRT 다운로드: ${downloadLink}`,
      ``,
      `--`,
      `업로드된 영상은 학습에 사용되지 않으며, 30일 후 자동 삭제됩니다.`,
    ].join('\n'),
  };
}

export interface JobFailedTemplateInput {
  videoOriginalName: string;
  errorMessage: string;
  jobId: string;
}

export function jobFailedTemplate(input: JobFailedTemplateInput) {
  const safeName = escapeHtml(input.videoOriginalName);
  const safeErr = escapeHtml(input.errorMessage);
  return {
    subject: `[make_cc] 자막 생성 실패 — ${input.videoOriginalName}`,
    html: `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;">
    <h1 style="font-size:24px;margin:0 0 8px;color:#ff6b6b;">자막 생성 실패</h1>
    <p style="margin:0 0 16px;color:#9a9a9a;line-height:1.6;">
      <strong style="color:#fff;">${safeName}</strong> 처리 중 오류가 발생했습니다.
    </p>
    <pre style="background:#0a0a0a;color:#ff9999;padding:14px;border-radius:8px;font-size:12px;white-space:pre-wrap;">${safeErr}</pre>
    <p style="margin:16px 0 0;color:#666;font-size:12px;">job id: ${input.jobId}</p>
  </div>
</body></html>`,
    text: `자막 생성 실패\n\n${input.videoOriginalName} 처리 중 오류가 발생했습니다.\n\n에러: ${input.errorMessage}\njob id: ${input.jobId}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
