export interface WidgetConfig {
  siteKey: string;
  visitorId: string;
  apiBase: string;
  /** Layer 3 — site-owner-defined context injected via data-context attr or window.CortexLivechat.context */
  context?: Record<string, string | number | boolean>;
  /** Show the proactive welcome popup bubble (default true) */
  popup: boolean;
  /** Auto-open the chat panel on page load (default false) */
  autoOpen: boolean;
  /** Delay in ms before showing the popup bubble (default 1500) */
  popupDelay: number;
}

const VISITOR_ID_KEY = 'livechat_visitor_id';

export function resolveConfig(): WidgetConfig | null {
  const tag = findScriptTag();
  if (!tag) return null;
  const siteKey = tag.getAttribute('data-site');
  if (!siteKey) return null;

  const apiBase = tag.getAttribute('data-api') || originFromScriptSrc(tag) || '';
  const visitorId = readOrCreateVisitorId();

  let context: Record<string, string | number | boolean> | undefined;
  try {
    const attr = tag.getAttribute('data-context');
    if (attr) context = JSON.parse(attr) as Record<string, string | number | boolean>;
  } catch {}
  try {
    const wc = (window as unknown as Record<string, unknown>)['CortexLivechat'] as { context?: Record<string, string | number | boolean> } | undefined;
    if (wc?.context && typeof wc.context === 'object') context = { ...context, ...wc.context };
  } catch {}

  const popupAttr = tag.getAttribute('data-popup');
  const popup = popupAttr === null ? true : popupAttr !== 'false' && popupAttr !== '0';

  const autoOpenAttr = tag.getAttribute('data-open');
  const autoOpen = autoOpenAttr === 'true' || autoOpenAttr === '1';

  const delayAttr = tag.getAttribute('data-delay');
  const popupDelay = delayAttr !== null && /^\d+$/.test(delayAttr) ? parseInt(delayAttr, 10) : 1500;

  return { siteKey, visitorId, apiBase, context, popup, autoOpen, popupDelay };
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
