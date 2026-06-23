export {
  getRenderAdmin,
  markRenderRendering,
  markRenderDone,
  markRenderFailed,
  updateRenderProgress,
  fetchOldestPendingRender,
  createRender,
  getRender,
  getRenderStreamSnapshot,
  cleanupExpiredRenders,
  type RenderView,
  type RenderCleanupResult,
} from './service';

export { resolveRenderGating, PRO_MAX_RESOLUTION, type GatedRenderConfig } from './gating';
