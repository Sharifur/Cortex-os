import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

export default function GoPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('s') ?? params.get('session');
  const target = sessionId ? `/livechat?session=${encodeURIComponent(sessionId)}` : '/livechat';

  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      window.location.replace(target);
      setRedirected(true);
    }
  }, [target]);

  if (redirected) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Brand mark */}
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <MessageSquare className="w-8 h-8 text-primary-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Cortex OS — Live Chat</h1>
          <p className="text-sm text-muted-foreground">
            {sessionId ? 'A visitor is waiting for you.' : 'Open the live chat console.'}
          </p>
        </div>

        {/* Primary CTA — on Android with PWA installed this link triggers the Web APK handler */}
        <a
          href={target}
          className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 px-6 text-center shadow hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Open in Cortex OS
        </a>

        {/* Platform hints */}
        <div className="flex flex-col gap-4 w-full text-left">
          <div className="rounded-xl border border-border bg-muted/40 p-4 flex flex-col gap-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Android</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tap <strong>Open in Cortex OS</strong> above. If the PWA doesn't open, tap the
              browser menu (⋮) and choose <strong>Open in App</strong>.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 flex flex-col gap-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">iPhone / iPad</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tap the button above to open in Safari, then tap the Share icon and choose{' '}
              <strong>Add to Home Screen</strong> to install the app. Future email links will open
              directly in your browser.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          You'll need to sign in if your session has expired.
        </p>
      </div>
    </div>
  );
}
