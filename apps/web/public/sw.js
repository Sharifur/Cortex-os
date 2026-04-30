// Cortex OS service worker — minimal install + activate handlers so the app
// is installable as a PWA. We do NOT cache API responses or WebSocket
// upgrades — those need fresh data. Static assets fall through to the
// browser's default HTTP caching (Vite already fingerprints filenames).
//
// If you want offline shell, swap the fetch handler for a network-first
// cache-fallback strategy. For an operator console handling live data, that
// is more risk than benefit (stale UI on a dead network is worse than a
// clear "no connection" error).

const VERSION = 'cortex-os-v1';

self.addEventListener('install', (event) => {
  // Skip waiting so a new SW activates immediately on next refresh.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old cache buckets from previous SW versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Pass-through fetch handler. Required for a "controlled" PWA on Android Chrome.
self.addEventListener('fetch', (event) => {
  // Bypass non-GET, websockets, API routes — let the network handle them.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/agents/') ||
    url.pathname.startsWith('/livechat/') ||
    url.pathname.startsWith('/livechat-ws') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/approvals') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/integrations') ||
    url.pathname.startsWith('/knowledge-base') ||
    url.pathname.startsWith('/tasks') ||
    url.pathname.startsWith('/contacts') ||
    url.pathname.startsWith('/runs') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/metrics') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/mcp')
  ) {
    return;
  }
  // Everything else (HTML / JS / CSS / icons): default browser caching.
});
