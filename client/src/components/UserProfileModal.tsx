import { useEffect, useState } from 'react';
import { api } from '../api';
import type { User } from '../api';
import Avatar from './Avatar';
import { useStore } from '../store';

interface Props {
  userId: number;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const online = useStore((s) => s.online);

  useEffect(() => {
    async function load() {
      try {
        const u = await api<User>(`/users/${userId}`);
        setUser(u);
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-ink-dim hover:text-ink">
          <svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {loading ? (
          <div className="py-10 text-center text-sm text-ink-dim">Loading…</div>
        ) : !user ? (
          <div className="py-10 text-center text-sm text-danger">User not found</div>
        ) : (
          <div className="text-center space-y-4">
            <Avatar src={user.avatar_url} name={user.nickname} size={96} online={online.has(user.id)} />
            <div>
              <h2 className="text-xl font-bold">{user.nickname}</h2>
              <p className="text-xs text-ink-mute uppercase tracking-wider font-semibold mt-1">
                {online.has(user.id) ? 'Online' : 'Offline'}
              </p>
            </div>

            {user.bio ? (
              <div className="bg-bg-soft/50 rounded-xl p-4 text-sm text-ink-dim italic leading-relaxed">
                "{user.bio}"
              </div>
            ) : (
              <p className="text-sm text-ink-mute italic">No bio written yet.</p>
            )}

            <div className="pt-2">
              <button onClick={onClose} className="btn-primary w-full">Close Profile</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
