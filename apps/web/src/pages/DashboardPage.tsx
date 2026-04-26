import { Bot, LogOut, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Cortex OS</span>
          <span className="text-muted-foreground text-xs ml-1">v1.1</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </header>

      {/* Content */}
      <main className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-8">Platform overview — Phase 1 running</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Activity className="w-5 h-5 text-primary" />}
            label="Agent Runs"
            value="0"
            note="No agents configured yet"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            label="Pending Approvals"
            value="0"
            note="Nothing awaiting review"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
            label="Failures"
            value="0"
            note="All clear"
          />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Phase 1 complete ✓</p>
          <p>Next: Agent Runtime → LLM Router → Telegram Bot (Phase 1 continues)</p>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{note}</p>
    </div>
  );
}
