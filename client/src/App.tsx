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
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-medium text-ink-dim tracking-wide">Pulse Messenger</div>
        </div>
      </div>
    );
  }

  return me ? <Chat /> : <Auth />;
}
