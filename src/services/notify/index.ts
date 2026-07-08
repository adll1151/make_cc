// 이메일 단일 채널 (레거시 직접 호출 — 워커가 아직 사용)
export { sendJobCompleted, sendJobFailed } from './service';
export { jobCompletedTemplate, jobFailedTemplate } from './templates';

// 멀티채널 dispatcher (Email/Discord/both) — 신규 진입점 (module-5에서 워커가 전환)
export { dispatchJobCompleted, dispatchJobFailed } from './dispatch';
export { sendDiscordDM, isDiscordBotEnabled } from './discord';
export { getUserNotifyProfile, markDmBlocked } from './profile';
export { toDiscordCompletedMessage, toDiscordFailedMessage } from './format';

// 운영자 알림 (Discord 웹훅) — 셀프호스팅 폴링 워커용
// 장애(다운) / 기동·복구 / 처리오류 4종. 웹훅 미설정 시 전부 no-op.
export {
  maybeAlertWorkerDown,
  alertWorkerOnline,
  alertJobFailed,
  isWorkerAlertEnabled,
} from './worker-alert';
