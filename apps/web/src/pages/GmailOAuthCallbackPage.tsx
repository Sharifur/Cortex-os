import { useEffect, useRef } from 'react';

export default function GmailOAuthCallbackPage() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? undefined;
    const state = params.get('state') ?? undefined;
    const error = params.get('error') ?? undefined;

    const notify = (type: 'gmail-oauth-success' | 'gmail-oauth-error', message: string) => {
      if (window.opener) {
        window.opener.postMessage({ type, message }, window.location.origin);
        setTimeout(() => window.close(), 1500);
      }
    };

    if (error) {
      notify('gmail-oauth-error', `Google returned: ${error}`);
      return;
    }

    fetch('/gmail/oauth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          notify('gmail-oauth-success', `Successfully linked ${(data as any).email ?? ''}.`);
        } else {
          notify('gmail-oauth-error', (data as any).message ?? 'Token exchange failed');
        }
      })
      .catch((err) => {
        notify('gmail-oauth-error', err instanceof Error ? err.message : 'Network error');
      });
  }, []);

  return (
    <div
      style={{
        fontFamily: '-apple-system, system-ui, sans-serif',
        background: '#0b1020',
        color: '#e5e7eb',
        margin: 0,
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 12,
          padding: 32,
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Connecting your Gmail account...</p>
      </div>
    </div>
  );
}
