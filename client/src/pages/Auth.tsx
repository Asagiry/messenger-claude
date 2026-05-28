import { useState } from 'react';
import { api, setToken } from '../api';
import { useStore } from '../store';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const FEATURES = [
  { icon: '⚡', title: 'Real-time messaging', desc: 'Instant delivery via WebSockets' },
  { icon: '🔒', title: 'Private & secure', desc: 'Your conversations stay yours' },
  { icon: '✨', title: 'Beautiful by default', desc: 'Light & dark themes, smooth animations' },
  { icon: '👀', title: 'See what matters', desc: 'Read receipts, typing & online status' },
];

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const setMe = useStore((s) => s.setMe);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setResetSuccess('');
    setLoading(true);
    try {
      let resp;
      if (mode === 'login') {
        resp = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
        setToken(resp.token);
        setMe(resp.user);
      } else if (mode === 'register') {
        resp = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) });
        setToken(resp.token);
        setMe(resp.user);
      } else if (mode === 'forgot') {
        resp = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        setResetToken(resp.token);
        setMode('reset');
        setResetSuccess(`Reset code generated: ${resp.token}`);
      } else if (mode === 'reset') {
        await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, newPassword: password }) });
        setMode('login');
        setResetSuccess('Password updated successfully. Please sign in with your new password.');
        setLogin('');
        setPassword('');
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setMode('login');
    setLogin('alice');
    setPassword('alice');
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <div className="app-backdrop" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="absolute top-5 right-5 z-10 p-2.5 rounded-full bg-bg-card border border-bg-line text-ink-dim hover:text-ink hover:scale-110 transition-all shadow-soft"
      >
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
      </button>

      {/* Hero */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-16 xl:px-24 relative">
        <div className="max-w-lg animate-slide-up">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-bubble"
                 style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)))' }}>
              P
            </div>
            <span className="text-xl font-extrabold tracking-tight">Pulse</span>
          </div>
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Stay in sync.<br/>
            <span className="bg-clip-text text-transparent" style={{
              backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)) 60%, #3ddc97)'
            }}>
              Talk in real-time.
            </span>
          </h1>
          <p className="mt-6 text-lg text-ink-dim leading-relaxed">
            A minimal, modern messenger built for focused conversations.
            No noise. No distractions. Just you and your people.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="p-4 rounded-2xl bg-bg-card/60 border border-bg-line backdrop-blur-sm hover:border-brand/40 transition-colors animate-slide-up"
                style={{ animationDelay: `${100 + i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="text-2xl mb-1.5">{f.icon}</div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-ink-dim mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative">
        <div className="card w-full max-w-md p-8 animate-scale-in relative">
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold shadow-bubble"
                   style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)))' }}>
                P
              </div>
              <span className="text-lg font-extrabold tracking-tight">Pulse</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'login' && 'Welcome back'}
            {mode === 'register' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Choose a new password'}
          </h2>
          <p className="text-ink-dim text-sm mt-1.5">
            {mode === 'login' && 'Sign in to continue your conversations.'}
            {mode === 'register' && 'Join in seconds — no email confirmation needed.'}
            {mode === 'forgot' && 'Enter your email to generate a password recovery token.'}
            {mode === 'reset' && 'Enter your verification token and your new password.'}
          </p>

          {/* Tabs (only shown for login/register modes) */}
          {(mode === 'login' || mode === 'register') && (
            <div className="mt-6 inline-flex p-1 rounded-xl bg-bg-line/50 w-full">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setErr(''); setResetSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? 'bg-bg-card text-ink shadow-soft' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3 mt-5">
            {mode === 'login' && (
              <>
                <Field label="Email or nickname">
                  <input
                    className="input"
                    placeholder="alice"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <label className="block">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="block text-xs font-semibold text-ink-dim tracking-wide uppercase">Password</span>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setErr(''); setResetSuccess(''); }}
                      className="text-xs text-brand hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </>
            )}

            {mode === 'register' && (
              <>
                <Field label="Email">
                  <input
                    className="input"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="Nickname">
                  <input
                    className="input"
                    placeholder="3-20 chars, a-z 0-9 _"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
              </>
            )}

            {mode === 'forgot' && (
              <Field label="Email Address">
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
            )}

            {mode === 'reset' && (
              <>
                <Field label="Recovery Code (Token)">
                  <input
                    className="input"
                    placeholder="123456"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="New Password">
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
              </>
            )}

            {err && (
              <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-slide-up">
                {err}
              </div>
            )}

            {resetSuccess && (
              <div className="text-ink text-sm bg-brand/10 border border-brand/20 rounded-lg px-3 py-2 animate-slide-up">
                {resetSuccess}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5 text-base">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  Please wait…
                </span>
              ) : (
                <>
                  {mode === 'login' && 'Sign in'}
                  {mode === 'register' && 'Create account'}
                  {mode === 'forgot' && 'Send Reset Code'}
                  {mode === 'reset' && 'Update Password'}
                </>
              )}
            </button>

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => { setMode('login'); setErr(''); setResetSuccess(''); setPassword(''); }}
                className="btn-secondary w-full !py-2.5 text-base mt-2"
              >
                Back to Sign in
              </button>
            )}
          </form>

          {mode === 'login' && (
            <div className="mt-6 pt-5 border-t border-bg-line text-xs text-ink-mute text-center">
              Demo accounts:{' '}
              <button
                type="button"
                onClick={fillDemo}
                className="text-brand hover:underline font-medium"
              >
                try as alice
              </button>
              {' '}— other seeded users: bob, carol, dave, eve…
            </div>
          )}
        </div>
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
