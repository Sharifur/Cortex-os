import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  let target = input;
  if (API_BASE) {
    if (typeof input === 'string' && input.startsWith('/')) {
      target = API_BASE + input;
    } else if (input instanceof URL && input.origin === window.location.origin) {
      target = API_BASE + input.pathname + input.search;
    }
  }
  const res = await originalFetch(target, init);

  // Auto-logout on 401 from authenticated calls (skip the login endpoint itself)
  const url = typeof target === 'string' ? target : (target as URL | Request).toString();
  const isLogin = url.endsWith('/auth/login');
  if (res.status === 401 && !isLogin) {
    try {
      localStorage.removeItem('cortex-auth');
    } catch { /* ignore */ }
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return res;
};

// PWA: register the service worker so the app is installable on
// Android/Chrome and behaves like a standalone app on iOS. The SW itself is
// pass-through for API/socket routes — no offline data, just installability.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent — SW failure must never block the app.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
