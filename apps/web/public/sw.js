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
    url.pathname.startsWith('/mcp') ||
    url.pathname.startsWith('/push/')
  ) {
    return;
  }
  // Everything else (HTML / JS / CSS / icons): default browser caching.
});

// ─────────────────────────────────────────────────────────────────────────────
// Web Push — incoming notifications from the API.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = { title: 'Cortex OS', body: 'New activity', tag: undefined, url: '/livechat', renotify: false, icon: '/icon-192.png', requireInteraction: false };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      renotify: payload.renotify,
      icon: payload.icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/livechat' },
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: payload.requireInteraction ?? false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/livechat';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If a window is already open, focus it and navigate.
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(target); } catch { /* cross-origin, ignore */ }
          } else if (client.postMessage) {
            client.postMessage({ type: 'navigate', url: target });
          }
          return;
        }
      }
      // Otherwise open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
