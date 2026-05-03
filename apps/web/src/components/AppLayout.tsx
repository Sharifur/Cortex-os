import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bot, LogOut, LayoutDashboard, Settings, Activity, User, KeyRound, ChevronDown, AlertTriangle, Plug, Cable, BookOpen, CheckSquare, HeartPulse, Radio, Mail, Bug, Users, Bell, DollarSign, MessageSquare, Menu, X, ScrollText, MessageCircleQuestion, ShieldAlert, BookMarked } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime';

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

interface NotifSummary {
  waitingChats: number;
  pendingApprovals: number;
  agentFailures: number;
  kbProposals: number;
  total: number;
}

const FAILURES_SEEN_KEY = 'agent-failures-seen-at';

function getFailuresSince(): string {
  try {
    const v = localStorage.getItem(FAILURES_SEEN_KEY);
    if (v) return v;
  } catch { /* ignore */ }
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function markFailuresSeen() {
  try { localStorage.setItem(FAILURES_SEEN_KEY, new Date().toISOString()); } catch { /* ignore */ }
}

function NotificationBell({ token }: { token: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<NotifSummary>({
    queryKey: ['notifications-summary'],
    queryFn: async () => {
      const since = getFailuresSince();
      const res = await fetch(`/notifications/summary?failuresSince=${encodeURIComponent(since)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { waitingChats: 0, pendingApprovals: 0, agentFailures: 0, kbProposals: 0, total: 0 };
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const total = data?.total ?? 0;

  // Auto-dismiss failure count when user is on /activity
  useEffect(() => {
    if (location.pathname === '/activity' && (data?.agentFailures ?? 0) > 0) {
      markFailuresSeen();
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    }
  }, [location.pathname, data?.agentFailures, queryClient]);

  useEffect(() => {
    const socket = getRealtimeSocket(token);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });

    const onConnect = () => {
      socket.emit('approvals:subscribe');
      socket.emit('activity:subscribe');
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('approval:created', invalidate);
    socket.on('approval:removed', invalidate);
    socket.on('activity:log', invalidate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('approval:created', invalidate);
      socket.off('approval:removed', invalidate);
      socket.off('activity:log', invalidate);
      socket.emit('approvals:unsubscribe');
      socket.emit('activity:unsubscribe');
    };
  }, [token, queryClient]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function go(to: string) {
    if (to === '/activity') {
      markFailuresSeen();
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    }
    navigate(to);
    setOpen(false);
  }

  const items = [
    {
      icon: <MessageCircleQuestion className="w-4 h-4 text-sky-400" />,
      label: 'Chats waiting for reply',
      count: data?.waitingChats ?? 0,
      to: '/livechat',
    },
    {
      icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
      label: 'Pending approvals',
      count: data?.pendingApprovals ?? 0,
      to: '/approvals',
    },
    {
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      label: 'Agent failures (24h)',
      count: data?.agentFailures ?? 0,
      to: '/activity',
    },
    {
      icon: <BookMarked className="w-4 h-4 text-violet-400" />,
      label: 'KB proposals pending',
      count: data?.kbProposals ?? 0,
      to: '/knowledge-base',
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
            Needs attention
          </div>
          {items.map((item) => (
            <button
              key={item.to}
              onClick={() => go(item.to)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
            >
              {item.icon}
              <span className="flex-1 text-sm text-muted-foreground">{item.label}</span>
              <span className={`text-xs font-semibold tabular-nums min-w-[20px] text-right ${item.count > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
  { to: '/agents', icon: <Bot className="w-4 h-4" />, label: 'Agents' },
  { to: '/livechat', icon: <MessageSquare className="w-4 h-4" />, label: 'Live Chat' },
  { to: '/knowledge-base', icon: <BookOpen className="w-4 h-4" />, label: 'Knowledge' },
  { to: '/tasks', icon: <CheckSquare className="w-4 h-4" />, label: 'Tasks' },
  { to: '/inbox', icon: <Mail className="w-4 h-4" />, label: 'Inbox' },
  { to: '/contacts', icon: <Users className="w-4 h-4" />, label: 'Contacts' },
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

function Sidebar({
  approvalCount,
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  approvalCount: number;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <div className="h-12 px-3 border-b border-border flex items-center gap-2 shrink-0">
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center text-primary hover:bg-accent/50 rounded-lg py-2 transition-colors"
            title="Expand menu"
          >
            <Bot className="w-5 h-5" />
          </button>
        ) : (
          <>
            <Bot className="w-5 h-5 text-primary shrink-0" />
            <span className="font-semibold text-sm">Cortex OS</span>
            <span className="text-muted-foreground text-xs">v3.1.6</span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                title="Collapse menu"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            )}
          </>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            {item.icon}
            {!collapsed && item.label}
            {!collapsed && item.badge && approvalCount > 0 && (
              <span className="ml-auto text-xs bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded-full font-medium">
                {approvalCount}
              </span>
            )}
            {collapsed && item.badge && approvalCount > 0 && (
              <span className="absolute right-1 top-1 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/**
 * iOS-Safari "Add to Home Screen" hint + Android Chrome's beforeinstallprompt.
 * Shows once per device until dismissed. Hidden when running standalone
 * (already installed) or on desktop. Banner appears at the bottom of the
 * viewport so it doesn't fight with the top header.
 */
function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already running as installed PWA — skip everything.
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem('pwa-install-dismissed') === '1'; } catch { /* ignore */ }
    if (dismissed) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS doesn't fire beforeinstallprompt — show the manual "Share → Add to
    // Home Screen" hint for iOS Safari instead, after a short delay so it
    // doesn't appear instantly on every page load.
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    if (isIos) {
      const t = setTimeout(() => { setIosHint(true); setVisible(true); }, 4000);
      return () => {
        window.removeEventListener('beforeinstallprompt', onPrompt);
        clearTimeout(t);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem('pwa-install-dismissed', '1'); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    dismiss();
  }

  if (!visible) return null;
  return (
    <div className="md:hidden fixed bottom-4 left-3 right-3 z-50 bg-card border border-border rounded-xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-2">
      <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Bot className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Install Cortex OS</div>
        <div className="text-[11px] text-muted-foreground">
          {iosHint ? 'Tap Share, then "Add to Home Screen".' : 'Use it like an app — instant launch, no browser bar.'}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!iosHint && (
          <button onClick={install} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Install</button>
        )}
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const token = useAuthStore((s) => s.token)!;
  const navigate = useNavigate();
  const approvalCount = useApprovalCount(token);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Desktop sidebar collapse state — persisted. Auto-collapses on the first
  // visit to /livechat in this session (operators want horizontal space for
  // the 3-column inbox); after that, the user's toggle wins.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('lc-app-sidebar-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lc-app-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  const seenLivechatRef = useRef(false);
  useEffect(() => {
    if (location.pathname.startsWith('/livechat') && !seenLivechatRef.current) {
      seenLivechatRef.current = true;
      setSidebarCollapsed(true);
    }
  }, [location.pathname]);

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
      {/* Desktop sidebar — pinned on md+. Auto-collapses on /livechat;
          operator can also toggle manually anywhere. */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-14' : 'w-56'} shrink-0 border-r border-border flex-col h-full transition-[width] duration-150`}>
        <Sidebar
          approvalCount={approvalCount}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
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
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Cortex OS</span>
            <span className="text-muted-foreground text-xs">v3.1.6</span>
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
        <header className="shrink-0 border-b border-border px-3 sm:px-5 flex items-center justify-between md:justify-end gap-2" style={{ height: 'calc(3rem + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/changelog')}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Changelog"
              title="Changelog"
            >
              <ScrollText className="w-4 h-4" />
            </button>
            <NotificationBell token={token} />
            <UserMenu />
          </div>
        </header>
        <main className={`flex-1 ${/\/agents\/[^/]+\/chat/.test(location.pathname) ? 'overflow-hidden' : 'overflow-auto'}`}>
          <Outlet />
        </main>
      </div>
      <InstallPwaBanner />
    </div>
  );
}
