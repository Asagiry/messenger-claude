import { useEffect, useState } from 'react';
import { api } from './api';
import { useStore } from './store';
import Auth from './pages/Auth';
import Chat from './pages/Chat';

export default function App() {
  const me = useStore((s) => s.me);
  const setMe = useStore((s) => s.setMe);
  const [init, setUninit] = useState(true);

  useEffect(() => {
    async function loadMe() {
      try {
        const u = await api('/auth/me');
        setMe(u);
      } catch {
        setMe(null);
      } finally {
        setUninit(false);
      }
    }
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (init) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg relative overflow-hidden">
        <div className="app-backdrop" />
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-bubble animate-pulse"
            style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)) 60%, #3ddc97)' }}
          >
            P
          </div>
          <div className="text-sm font-medium text-ink-dim tracking-wide">Pulse Messenger</div>
          <div className="w-8 h-8 border-[3px] border-brand/70 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return me ? <Chat /> : <Auth />;
}
