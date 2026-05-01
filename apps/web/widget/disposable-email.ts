// Block disposable / temporary email providers from the visitor identify
// flow. Source list lives in a public gist; we cache it in localStorage
// for 24h so the widget doesn't re-fetch on every page load.

const SOURCE_URL =
  'https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json';

const CACHE_KEY = 'livechat_disposable_domains';
const CACHE_TS_KEY = 'livechat_disposable_domains_ts';
const TTL_MS = 24 * 60 * 60 * 1000;

let cached: Set<string> | null = null;

/** Lower-cased Set, populated lazily. Falls back to a tiny built-in list when the fetch fails. */
async function getDomainSet(): Promise<Set<string>> {
  if (cached) return cached;

  // Try the localStorage cache first.
  try {
    const tsRaw = localStorage.getItem(CACHE_TS_KEY);
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = tsRaw ? Number(tsRaw) : 0;
    if (raw && ts && Date.now() - ts < TTL_MS) {
      const arr = JSON.parse(raw) as string[];
      cached = new Set(arr.map((d) => d.toLowerCase()));
      return cached;
    }
  } catch { /* ignore */ }

  // Fetch fresh list. Don't block the visitor for too long — 4s timeout.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(SOURCE_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const arr: string[] = Array.isArray(data) ? data : [];
      const lower = arr.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
      cached = new Set(lower);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(lower));
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
      } catch { /* ignore quota errors */ }
      return cached;
    }
  } catch { /* fall through */ }

  // Last resort: hard-coded most common throwaway providers so the gate
  // still has some teeth even if the gist is unreachable.
  cached = new Set([
    'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
    'temp-mail.org', 'yopmail.com', 'trashmail.com', 'fakeinbox.com',
    'throwawaymail.com', 'getairmail.com', 'sharklasers.com',
  ]);
  return cached;
}

/**
 * Returns true when the email's domain is on the disposable list. Also true
 * for malformed addresses (caller usually validates format separately).
 */
export async function isDisposableEmail(email: string): Promise<boolean> {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  const set = await getDomainSet();
  return set.has(domain);
}

/** Eagerly warm the cache on widget mount so the user doesn't wait when typing. */
export function warmDisposableEmailCache() {
  void getDomainSet();
}
