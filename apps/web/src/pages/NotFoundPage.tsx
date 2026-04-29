import { Link, useLocation } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-rose-400" />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Error 404</p>
        <h1 className="text-3xl font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-1">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <code className="inline-block mt-1 text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1 text-muted-foreground break-all">
          {location.pathname}
        </code>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
          <Link to="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
