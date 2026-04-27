import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import SettingsPage from '@/pages/SettingsPage';
import ActivityPage from '@/pages/ActivityPage';
import ProfilePage from '@/pages/ProfilePage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import AgentsPage from '@/pages/AgentsPage';
import AgentDetailPage from '@/pages/AgentDetailPage';
import AgentChatPage from '@/pages/AgentChatPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import RunDetailPage from '@/pages/RunDetailPage';
import McpPage from '@/pages/McpPage';
import AppLayout from '@/components/AppLayout';
import { useAuthStore } from '@/stores/authStore';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s._hydrated);
  if (!hydrated) return null;
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/:key" element={<AgentDetailPage />} />
            <Route path="/agents/:key/chat" element={<AgentChatPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="/mcp" element={<McpPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
