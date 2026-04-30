import type { WidgetConfig } from './config';
import { trackPageview, trackLeave, trackHeartbeat } from './api';

let lastPath = '';
let lastPageviewId: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
const HEARTBEAT_INTERVAL_MS = 30_000;

export function startTracker(cfg: WidgetConfig) {
  fire(cfg);
  patchHistory(cfg);
  window.addEventListener('popstate', () => schedule(cfg));
  window.addEventListener('pagehide', () => {
    if (lastPageviewId) trackLeave(cfg, lastPageviewId);
  });
  startHeartbeat(cfg);
}

function startHeartbeat(cfg: WidgetConfig) {
  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    trackHeartbeat(cfg, { url: location.href, title: document.title });
  };
  setInterval(tick, HEARTBEAT_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

function patchHistory(cfg: WidgetConfig) {
  const orig = {
    pushState: history.pushState,
    replaceState: history.replaceState,
  };
  history.pushState = function (...args) {
    const ret = orig.pushState.apply(this, args as Parameters<typeof history.pushState>);
    schedule(cfg);
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = orig.replaceState.apply(this, args as Parameters<typeof history.replaceState>);
    schedule(cfg);
    return ret;
  };
}

function schedule(cfg: WidgetConfig) {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => fire(cfg), 300);
}

async function fire(cfg: WidgetConfig) {
  pendingTimer = null;
  const path = location.pathname + location.search;
  if (path === lastPath) return;
  lastPath = path;

  if (lastPageviewId) trackLeave(cfg, lastPageviewId);

  try {
    const res = await trackPageview(cfg, {
      url: location.href,
      path: location.pathname,
      title: document.title,
      referrer: document.referrer,
      language: navigator.language,
    });
    lastPageviewId = res.pageviewId ?? null;
  } catch {
    // Silently ignore; tracker should never break the host page.
  }
}
