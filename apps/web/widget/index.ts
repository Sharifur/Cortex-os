import { mountWidget } from './ui';
import { startTracker } from './tracker';
import { resolveConfig } from './config';
import { fetchSiteConfig } from './api';

declare global {
  interface Window {
    __livechat__?: { mounted: boolean; siteKey: string; visitorId: string };
  }
}

(function bootstrap() {
  if (typeof window === 'undefined') return;
  if (window.__livechat__?.mounted) return;

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
