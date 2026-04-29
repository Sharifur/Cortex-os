export const faviconSvg = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M32 12 L16 19 v14 c0 11 7 18 16 21 c9 -3 16 -10 16 -21 V19 z"
        fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="3" fill="#ffffff"/>
</svg>`;

const layout = (opts: {
  title: string;
  status: string;
  heading: string;
  body: string;
  accent: string;
}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${opts.title}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @keyframes float { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-12px) } }
  .float-slow { animation: float 6s ease-in-out infinite; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
</style>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
  <div class="fixed inset-0 -z-10 overflow-hidden">
    <div class="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-3xl"></div>
    <div class="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-${opts.accent}-500/20 blur-3xl"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(99,102,241,0.15),transparent_60%)]"></div>
  </div>

  <main class="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
    <div class="float-slow mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-${opts.accent}-500 shadow-2xl shadow-indigo-500/40 ring-1 ring-white/10">
      <svg viewBox="0 0 24 24" fill="none" class="h-8 w-8 text-white" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2 L4 6 v6 c0 5 3.5 8 8 10 c4.5-2 8-5 8-10 V6 z"/>
      </svg>
    </div>

    <p class="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-${opts.accent}-300/80">${opts.status}</p>
    <h1 class="bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">${opts.heading}</h1>
    <p class="mt-5 max-w-xl text-base leading-relaxed text-slate-400">${opts.body}</p>

    <div class="mt-10 flex items-center gap-3 text-xs text-slate-500">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/70"></span>
      <span>Cortex OS API</span>
      <span class="text-slate-700">/</span>
      <span>Single-owner agent platform</span>
    </div>
  </main>
</body>
</html>`;

export const homePage = (): string =>
  layout({
    title: 'Cortex OS API',
    status: 'Service online',
    heading: 'Cortex OS API',
    body: 'You have reached the internal API for the Cortex OS agent platform. Tenant traffic is not served on this host. If you are looking for the dashboard, head to the web application.',
    accent: 'emerald',
  });

export const notFoundPage = (path: string): string =>
  layout({
    title: '404 — Not Found',
    status: 'Error 404',
    heading: 'This route does not exist',
    body: `The path <span class="rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-300">${escapeHtml(path)}</span> was not found on this server. Check the URL or return to the home page.`,
    accent: 'amber',
  });

export const forbiddenPage = (): string =>
  layout({
    title: '403 — Forbidden',
    status: 'Error 403',
    heading: 'You do not have access',
    body: 'Authentication is required, or your token does not grant access to this resource. If you believe this is a mistake, contact the workspace owner.',
    accent: 'rose',
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
