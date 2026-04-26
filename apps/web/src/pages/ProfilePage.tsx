import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User, Lock, Mail, Calendar, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/auth/password', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to change password');
  }
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-9 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const token = useAuthStore((s) => s.token)!;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchMe(token),
  });

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const changePwMutation = useMutation({
    mutationFn: () => changePassword(token, current, next),
    onSuccess: () => {
      setSuccess(true);
      setError('');
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    changePwMutation.mutate();
  }

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
      <p className="text-muted-foreground text-sm mb-8">Your account details and security settings.</p>

      {/* Account info */}
      <div className="rounded-xl border border-border bg-card mb-6">
        <div className="px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold">Account</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Member since</p>
                  <p className="text-sm font-medium">{memberSince}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Lock className="w-4 h-4" />
          <span className="text-sm font-semibold">Change Password</span>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <PasswordField
            label="Current password"
            value={current}
            onChange={setCurrent}
            placeholder="Enter current password"
          />
          <PasswordField
            label="New password"
            value={next}
            onChange={setNext}
            placeholder="At least 8 characters"
          />
          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat new password"
          />

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Password updated successfully.
            </div>
          )}

          <Button
            type="submit"
            disabled={!current || !next || !confirm || changePwMutation.isPending}
            className="w-full"
          >
            {changePwMutation.isPending ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
