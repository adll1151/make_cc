export {
  getRenderAdmin,
  markRenderRendering,
  markRenderDone,
  markRenderFailed,
  fetchOldestPendingRender,
  createRender,
  getRender,
  cleanupExpiredRenders,
  type RenderView,
  type RenderCleanupResult,
} from './service';

export { resolveRenderGating, PRO_MAX_RESOLUTION, type GatedRenderConfig } from './gating';
