import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  _hydrated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      _hydrated: false,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
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
