import { create } from 'zustand';
import type { User } from './api';

interface State {
  me: User | null;
  online: Set<number>;
  setMe: (u: User | null) => void;
  setOnline: (ids: number[]) => void;
  markOnline: (id: number, online: boolean) => void;
}

export const useStore = create<State>((set) => ({
  me: null,
  online: new Set(),
  setMe: (me) => set({ me }),
  setOnline: (ids) => set({ online: new Set(ids) }),
  markOnline: (id, online) =>
    set((s) => {
      const next = new Set(s.online);
      if (online) next.add(id); else next.delete(id);
      return { online: next };
    }),
}));
