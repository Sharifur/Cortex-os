import { useQuery } from '@tanstack/react-query';
import { User, Mail, Calendar, Hash } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Profile {
  id: string;
  email: string;
  telegramChatId: string | null;
  createdAt: string;
}

async function fetchMe(token: string): Promise<Profile> {
  const res = await fetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export default function ProfilePage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchMe(token),
  });

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Profile</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">Your account information.</p>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold">Account</span>
        </div>
        <div className="px-5 py-5 space-y-5">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="text-sm text-destructive">Failed to load profile.</p>}
          {profile && (
            <>
              <InfoRow icon={<Mail className="w-4 h-4 text-muted-foreground" />} label="Email" value={profile.email} />
              <InfoRow icon={<Calendar className="w-4 h-4 text-muted-foreground" />} label="Member since" value={memberSince} />
              <InfoRow
                icon={<Hash className="w-4 h-4 text-muted-foreground" />}
                label="Telegram Chat ID"
                value={profile.telegramChatId ?? 'Not linked'}
                muted={!profile.telegramChatId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${muted ? 'text-muted-foreground' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
