import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

async function changePassword(token: string, newPassword: string) {
  const res = await fetch('/auth/password', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newPassword }),
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

export default function ChangePasswordPage() {
  const token = useAuthStore((s) => s.token)!;

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => changePassword(token, next),
    onSuccess: () => {
      setSuccess(true);
      setError('');
      setNext('');
      setConfirm('');
      setTimeout(() => setSuccess(false), 5000);
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
      setError('Passwords do not match.');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Change Password</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">Update your account password.</p>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-3 border-b border-border">
          <span className="text-sm font-semibold">Security</span>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
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
            disabled={!next || !confirm || mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
