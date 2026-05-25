import { useState } from 'react';
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
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-ink-dim hover:text-ink">
          <svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar src={avatar} name={nickname} size={80} />
            <div className="text-xs text-ink-mute">Preview</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-dim mb-1 uppercase">Nickname</label>
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-dim mb-1 uppercase">Avatar Image URL</label>
            <input className="input" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://example.com/avatar.png" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-dim mb-1 uppercase">Bio</label>
            <textarea className="input resize-none" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-dim mb-1 uppercase">Change Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
          </div>

          {err && <div className="text-danger text-sm">{err}</div>}
          {success && <div className="text-success text-sm font-medium">Profile updated successfully!</div>}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
