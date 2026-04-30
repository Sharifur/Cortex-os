// Web Push subscribe / unsubscribe helpers used by the operator UI.
// Talks to /push/* endpoints — fetches the public VAPID key, asks for browser
// permission, registers a subscription, and posts it to the API.

interface VapidKeyResponse {
  publicKey: string | null;
  configured: boolean;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const sanitized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(sanitized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushStatus {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | 'default';
  subscribed: boolean;
}

export async function getPushStatus(token: string): Promise<PushStatus> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return { supported: false, configured: false, permission: 'default', subscribed: false };

  let configured = false;
  try {
    const res = await fetch('/push/vapid-public-key', { headers: { Authorization: `Bearer ${token}` } });
    const data: VapidKeyResponse = res.ok ? await res.json() : { publicKey: null, configured: false };
    configured = !!data.configured;
  } catch {
    // ignore
  }

  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    subscribed = !!sub;
  } catch {
    // ignore
  }
  return {
    supported: true,
    configured,
    permission: Notification.permission,
    subscribed,
  };
}

export async function subscribePush(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push not supported in this browser' };
  }

  const keyRes = await fetch('/push/vapid-public-key', { headers: { Authorization: `Bearer ${token}` } });
  if (!keyRes.ok) return { ok: false, error: 'Could not fetch VAPID key' };
  const { publicKey, configured }: VapidKeyResponse = await keyRes.json();
  if (!configured || !publicKey) {
    return { ok: false, error: 'Push notifications are not configured by your admin (Settings → Notifications)' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notifications blocked. Allow in browser settings to enable push.' };
  }

  const reg = await navigator.serviceWorker.ready;
  // Cast: PushSubscriptionOptionsInit.applicationServerKey expects BufferSource;
  // TS 5+ tightened Uint8Array<ArrayBufferLike> vs ArrayBuffer-backed which the
  // browser API accepts but the type now rejects. Runtime is correct.
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = sub.toJSON();
  const res = await fetch('/push/subscribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });
  if (!res.ok) return { ok: false, error: 'Server rejected subscription' };
  return { ok: true };
}

export async function unsubscribePush(token: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/push/subscribe', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);
  }
}
