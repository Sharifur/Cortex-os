import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bot, LogOut, LayoutDashboard, Settings, Activity, User, KeyRound, ChevronDown, AlertTriangle, Plug, Cable, BookOpen, CheckSquare, HeartPulse } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';

function useApprovalCount(token: string) {
  const { data } = useQuery<{ length: number }>({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      const res = await fetch('/approvals', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    select: (data) => ({ length: Array.isArray(data) ? data.length : 0 }),
  });
  return data?.length ?? 0;
}

const NAV = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
  { to: '/agents', icon: <Bot className="w-4 h-4" />, label: 'Agents' },
  { to: '/knowledge-base', icon: <BookOpen className="w-4 h-4" />, label: 'Knowledge' },
  { to: '/tasks', icon: <CheckSquare className="w-4 h-4" />, label: 'Tasks' },
  { to: '/approvals', icon: <AlertTriangle className="w-4 h-4" />, label: 'Approvals', badge: true },
  { to: '/integrations', icon: <Cable className="w-4 h-4" />, label: 'Integrations' },
  { to: '/mcp', icon: <Plug className="w-4 h-4" />, label: 'MCP' },
  { to: '/activity', icon: <Activity className="w-4 h-4" />, label: 'Activity' },
  { to: '/health', icon: <HeartPulse className="w-4 h-4" />, label: 'Health' },
  { to: '/settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
];

function UserMenu() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function go(to: string) {
    navigate(to);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs font-medium">Admin</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
          <button
            onClick={() => go('/profile')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => go('/change-password')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            Change Password
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const token = useAuthStore((s) => s.token)!;
  const approvalCount = useApprovalCount(token);

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col h-full">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Cortex OS</span>
          <span className="text-muted-foreground text-xs">v1.1</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`
              }
            >
              {item.icon}
              {item.label}
              {item.badge && approvalCount > 0 && (
                <span className="ml-auto text-xs bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded-full font-medium">
                  {approvalCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-12 shrink-0 border-b border-border px-5 flex items-center justify-end">
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
