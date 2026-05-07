import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  role: string | null;
  _hydrated: boolean;
  setToken: (token: string) => void;
  setRole: (role: string) => void;
  logout: () => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      _hydrated: false,
      setToken: (token) => set({ token }),
      setRole: (role) => set({ role }),
      logout: () => set({ token: null, role: null }),
      setHydrated: (v) => set({ _hydrated: v }),
    }),
    {
      name: 'cortex-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
