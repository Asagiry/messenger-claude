import { useState, useEffect } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: Props) {
  const me = useStore((s) => s.me)!;
  const setMe = useStore((s) => s.setMe);

  const [nickname, setNickname] = useState(me.nickname);
  const [avatar, setAvatar] = useState(me.avatar_url);
  const [bio, setBio] = useState(me.bio);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSuccess(false);
    setLoading(true);
    try {
      const body: any = { nickname, avatar_url: avatar, bio };
      if (password) body.password = password;
      const updated = await api<any>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setMe(updated);
      setSuccess(true);
      setPassword('');
      setTimeout(() => setSuccess(false), 2200);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-lg text-ink-dim hover:text-ink hover:bg-bg-line/60 transition-colors flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <h2 className="text-xl font-bold tracking-tight">Edit profile</h2>
        <p className="text-sm text-ink-dim mt-1">Update how others see you in Pulse.</p>

        <form onSubmit={save} className="space-y-4 mt-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar src={avatar} name={nickname || me.nickname} size={88} ring />
            <div className="text-xs text-ink-mute">Live preview</div>
          </div>

          <Field label="Nickname">
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </Field>

          <Field label="Avatar image URL">
            <input className="input" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://example.com/avatar.png" />
          </Field>

          <Field label="Bio">
            <textarea className="input resize-none" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" />
          </Field>

          <Field label="Change password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
          </Field>

          {err && (
            <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-slide-up">{err}</div>
          )}
          {success && (
            <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-3 py-2 animate-slide-up">
              Profile updated successfully!
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-dim mb-1.5 tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}
