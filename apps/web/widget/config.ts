export interface WidgetConfig {
  siteKey: string;
  visitorId: string;
  apiBase: string;
}

const VISITOR_ID_KEY = 'livechat_visitor_id';

export function resolveConfig(): WidgetConfig | null {
  const tag = findScriptTag();
  if (!tag) return null;
  const siteKey = tag.getAttribute('data-site');
  if (!siteKey) return null;

  const apiBase = tag.getAttribute('data-api') || originFromScriptSrc(tag) || '';
  const visitorId = readOrCreateVisitorId();
  return { siteKey, visitorId, apiBase };
}

function findScriptTag(): HTMLScriptElement | null {
  const all = document.querySelectorAll<HTMLScriptElement>('script[data-site]');
  return all.length ? all[all.length - 1] : null;
}

function originFromScriptSrc(tag: HTMLScriptElement): string | null {
  if (!tag.src) return null;
  try {
    const u = new URL(tag.src);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function readOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const fresh = generateUuid();
    localStorage.setItem(VISITOR_ID_KEY, fresh);
    return fresh;
  } catch {
    return generateUuid();
  }
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // RFC4122 v4 fallback
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
