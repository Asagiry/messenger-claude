import { useState } from 'react';
import { api, setToken } from '../api';
import { useStore } from '../store';

type Mode = 'login' | 'register';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const setMe = useStore((s) => s.setMe);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      let resp;
      if (mode === 'login') {
        resp = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
      } else {
        resp = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) });
      }
      setToken(resp.token);
      setMe(resp.user);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/20 mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Pulse</h1>
          <p className="text-ink-dim text-sm mt-1">
            {mode === 'login' ? 'Sign in to continue chatting' : 'Create an account to get started'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'login' ? (
            <input
              className="input"
              placeholder="Email or nickname"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          ) : (
            <>
              <input
                className="input"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="input"
                placeholder="Nickname (3-20 chars, a-z 0-9 _)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </>
          )}
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {err && <div className="text-danger text-sm">{err}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="text-center mt-5 text-sm text-ink-dim">
          {mode === 'login' ? (
            <>No account?{' '}
              <button onClick={() => { setMode('register'); setErr(''); }} className="text-brand hover:underline">Register</button>
            </>
          ) : (
            <>Already have one?{' '}
              <button onClick={() => { setMode('login'); setErr(''); }} className="text-brand hover:underline">Sign in</button>
            </>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-bg-line text-xs text-ink-mute text-center">
          Demo accounts: <code className="text-ink-dim">alice / alice</code>, <code className="text-ink-dim">bob / bob</code>, etc.
        </div>
      </div>
    </div>
  );
}
