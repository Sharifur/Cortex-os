import type { WidgetConfig } from './config';

export interface SiteConfigResponse {
  siteKey: string;
  botName: string;
  botSubtitle: string;
  welcomeMessage: string | null;
  welcomeQuickReplies?: string[];
  brandColor: string;
  position: 'bottom-right' | 'bottom-left';
}

export async function fetchSiteConfig(cfg: WidgetConfig): Promise<SiteConfigResponse | null> {
  try {
    const res = await fetch(`${cfg.apiBase}/livechat/config?siteKey=${encodeURIComponent(cfg.siteKey)}`, {
      method: 'GET',
      credentials: 'omit',
    });
    if (!res.ok) return null;
    return (await res.json()) as SiteConfigResponse;
  } catch {
    return null;
  }
}

export interface PageviewResponse {
  ok: boolean;
  pageviewId?: string;
  visitorPk?: string;
  skipped?: string;
}

export interface AttachmentSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  url: string;
}

export interface MessageResponse {
  ok: boolean;
  sessionId: string;
  visitor: { id: string; createdAt: string; attachments?: AttachmentSummary[] };
  agent:
    | { id: string; content: string; status: string }
    | { skipped: string };
}

export async function uploadAttachment(cfg: WidgetConfig, sessionId: string, file: File): Promise<AttachmentSummary> {
  const fd = new FormData();
  fd.append('siteKey', cfg.siteKey);
  fd.append('visitorId', cfg.visitorId);
  fd.append('sessionId', sessionId);
  fd.append('file', file, file.name);
  const res = await fetch(`${cfg.apiBase}/livechat/upload`, { method: 'POST', body: fd, credentials: 'omit' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export function trackPageview(cfg: WidgetConfig, payload: { url: string; path: string; title: string; referrer: string; language: string }) {
  return postJson<PageviewResponse>(`${cfg.apiBase}/livechat/track/pageview`, {
    siteKey: cfg.siteKey,
    visitorId: cfg.visitorId,
    ...payload,
  });
}

export function trackHeartbeat(cfg: WidgetConfig, payload: { url?: string; title?: string }) {
  return postJson<{ ok: boolean }>(`${cfg.apiBase}/livechat/track/heartbeat`, {
    siteKey: cfg.siteKey,
    visitorId: cfg.visitorId,
    url: payload.url,
    title: payload.title,
  }).catch(() => undefined);
}

export function trackLeave(cfg: WidgetConfig, pageviewId: string) {
  // sendBeacon survives navigation; falls back to fetch with keepalive.
  const url = `${cfg.apiBase}/livechat/track/leave`;
  const body = JSON.stringify({ siteKey: cfg.siteKey, visitorId: cfg.visitorId, pageviewId });
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

export interface SendMessageMeta {
  hp?: string;
  elapsedMs?: number;
  hadInteraction?: boolean;
}

export function sendMessage(cfg: WidgetConfig, content: string, attachmentIds?: string[], meta?: SendMessageMeta) {
  return postJson<MessageResponse>(`${cfg.apiBase}/livechat/message`, {
    siteKey: cfg.siteKey,
    visitorId: cfg.visitorId,
    content,
    attachmentIds: attachmentIds && attachmentIds.length ? attachmentIds : undefined,
    meta,
  });
}

export function identify(cfg: WidgetConfig, identity: { email?: string; name?: string }) {
  return postJson<{ ok: boolean }>(`${cfg.apiBase}/livechat/identify`, {
    siteKey: cfg.siteKey,
    visitorId: cfg.visitorId,
    email: identity.email,
    name: identity.name,
  });
}
