import { useEffect, useState } from 'react';
import { api } from '../api';
import type { User } from '../api';
import Avatar from './Avatar';
import { useStore } from '../store';

interface Props {
  userId: number;
  onClose: () => void;
}

function fmtLastSeen(iso?: string) {
  if (!iso) return 'offline';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const online = useStore((s) => s.online);
  const isOnline = user ? online.has(user.id) : false;

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm overflow-hidden !p-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 w-8 h-8 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Gradient header */}
        <div
          className="h-28 relative"
          style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-hover)) 60%, #3ddc97 130%)' }}
        />

        <div className="px-6 pb-6 -mt-12 text-center">
          {loading ? (
            <>
              <div className="mx-auto skeleton w-24 h-24 rounded-full" />
              <div className="mt-4 skeleton h-5 w-32 mx-auto" />
              <div className="mt-2 skeleton h-3 w-20 mx-auto" />
            </>
          ) : !user ? (
            <div className="py-8 text-sm text-danger">User not found</div>
          ) : (
            <>
              <div className="inline-block">
                <Avatar src={user.avatar_url} name={user.nickname} size={96} ring />
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight">{user.nickname}</h2>
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success' : 'bg-ink-mute'}`} />
                <span className="text-ink-dim">
                  {isOnline ? 'Online now' : `Last seen ${fmtLastSeen(user.last_seen)}`}
                </span>
              </div>

              <div className="mt-5">
                {user.bio ? (
                  <div className="bg-bg-soft/70 rounded-xl p-4 text-sm text-ink-dim italic leading-relaxed text-left">
                    “{user.bio}”
                  </div>
                ) : (
                  <p className="text-sm text-ink-mute italic">No bio written yet.</p>
                )}
              </div>

              <div className="mt-5">
                <button onClick={onClose} className="btn-primary w-full">Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
