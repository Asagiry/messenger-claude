import { create } from 'zustand';
import type { User } from './api';

export type Theme = 'light' | 'dark';
export type ConnState = 'idle' | 'connecting' | 'online' | 'offline';

const THEME_KEY = 'msg_theme';

function detectInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface State {
  me: User | null;
  online: Set<number>;
  theme: Theme;
  conn: ConnState;
  setMe: (u: User | null) => void;
  setOnline: (ids: number[]) => void;
  markOnline: (id: number, online: boolean) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setConn: (c: ConnState) => void;
}

const initialTheme = detectInitialTheme();
applyTheme(initialTheme);

export const useStore = create<State>((set, get) => ({
  me: null,
  online: new Set(),
  theme: initialTheme,
  conn: 'idle',
  setMe: (me) => set({ me }),
  setOnline: (ids) => set({ online: new Set(ids) }),
  markOnline: (id, online) =>
    set((s) => {
      const next = new Set(s.online);
      if (online) next.add(id); else next.delete(id);
      return { online: next };
    }),
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },
  setConn: (conn) => set({ conn }),
}));
