import { mountWidget } from './ui';
import { startTracker } from './tracker';
import { resolveConfig } from './config';
import { fetchSiteConfig } from './api';

declare const __LIVECHAT_BUILD__: string;

declare global {
  interface Window {
    __livechat__?: { mounted: boolean; siteKey: string; visitorId: string };
  }
}

const CACHE_VERSION_KEY = 'livechat_build';
const STALE_CACHE_KEYS = [
  'livechat_messages_cache',
  'livechat_session_id',
  'livechat_identify_dismissed',
  'livechat_send_log',
  'livechat_proactive_seen',
];

function bustCacheIfStale() {
  try {
    if (localStorage.getItem(CACHE_VERSION_KEY) !== __LIVECHAT_BUILD__) {
      STALE_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(CACHE_VERSION_KEY, __LIVECHAT_BUILD__);
    }
  } catch {}
}

(function bootstrap() {
  if (typeof window === 'undefined') return;
  if (window.__livechat__?.mounted) return;

  bustCacheIfStale();

  const config = resolveConfig();
  if (!config) return; // missing data-site attribute → silently bail

  window.__livechat__ = { mounted: true, siteKey: config.siteKey, visitorId: config.visitorId };

  // Tracker first so a pageview is recorded even if the user never opens the chat.
  startTracker(config);

  const onReady = async () => {
    const siteConfig = await fetchSiteConfig(config);
    mountWidget(config, siteConfig ?? undefined);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
