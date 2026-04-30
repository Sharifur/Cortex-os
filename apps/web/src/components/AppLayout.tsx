import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bot, LogOut, LayoutDashboard, Settings, Activity, User, KeyRound, ChevronDown, AlertTriangle, Plug, Cable, BookOpen, CheckSquare, HeartPulse, Radio, Mail, Bug, Users, BellRing, DollarSign, MessageSquare, Menu, X } from 'lucide-react';
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
  { to: '/livechat', icon: <MessageSquare className="w-4 h-4" />, label: 'Live Chat' },
  { to: '/knowledge-base', icon: <BookOpen className="w-4 h-4" />, label: 'Knowledge' },
  { to: '/tasks', icon: <CheckSquare className="w-4 h-4" />, label: 'Tasks' },
  { to: '/inbox', icon: <Mail className="w-4 h-4" />, label: 'Inbox' },
  { to: '/contacts', icon: <Users className="w-4 h-4" />, label: 'Contacts' },
  { to: '/follow-ups', icon: <BellRing className="w-4 h-4" />, label: 'Follow-ups' },
  { to: '/approvals', icon: <AlertTriangle className="w-4 h-4" />, label: 'Approvals', badge: true },
  { to: '/integrations', icon: <Cable className="w-4 h-4" />, label: 'Integrations' },
  { to: '/mcp', icon: <Plug className="w-4 h-4" />, label: 'MCP' },
  { to: '/ops', icon: <Radio className="w-4 h-4" />, label: 'Operations' },
  { to: '/activity', icon: <Activity className="w-4 h-4" />, label: 'Activity' },
  { to: '/llm-usage', icon: <DollarSign className="w-4 h-4" />, label: 'LLM Usage' },
  { to: '/health', icon: <HeartPulse className="w-4 h-4" />, label: 'Health' },
  { to: '/debug-logs', icon: <Bug className="w-4 h-4" />, label: 'Debug Logs' },
  { to: '/settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
];

function UserMenu() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery<{ id: string; email: string; name: string | null } | null>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const displayName = me?.name?.trim() || me?.email?.split('@')[0] || 'Admin';

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
        <span className="text-xs font-medium hidden sm:inline">{displayName}</span>
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
            onClick={async () => {
              try {
                const tok = useAuthStore.getState().token;
                if (tok) {
                  await fetch('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } });
                }
              } catch { /* ignore */ }
              logout();
              navigate('/login');
            }}
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

function Sidebar({ approvalCount, onNavigate }: { approvalCount: number; onNavigate?: () => void }) {
  return (
    <>
      <div className="px-4 py-4 border-b border-border flex items-center gap-2 shrink-0">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">Cortex OS</span>
        <span className="text-muted-foreground text-xs">v1.8</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
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
    </>
  );
}

export default function AppLayout() {
  const token = useAuthStore((s) => s.token)!;
  const approvalCount = useApprovalCount(token);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (drawerOpen) document.body.classList.add('overflow-hidden');
    else document.body.classList.remove('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, [drawerOpen]);

  return (
    <div className="h-[100dvh] bg-background flex overflow-hidden">
      {/* Desktop sidebar — pinned on md+ */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border flex-col h-full">
        <Sidebar approvalCount={approvalCount} />
      </aside>

      {/* Mobile drawer + backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-[100dvh] w-64 border-r border-border bg-background flex flex-col transform transition-transform ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Cortex OS</span>
            <span className="text-muted-foreground text-xs">v1.8</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
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
        <header className="h-12 shrink-0 border-b border-border px-3 sm:px-5 flex items-center justify-between md:justify-end gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent/50"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="md:hidden flex items-center gap-2 text-sm font-medium">
            <Bot className="w-4 h-4 text-primary" />
            Cortex OS
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
