import { useEffect, useMemo, useRef, useState } from 'react';
import { api, clearToken } from '../api';
import type { Dialog, Message, User } from '../api';
import { useStore } from '../store';
import { wsClient } from '../ws';
import Avatar from '../components/Avatar';
import ProfileModal from '../components/ProfileModal';
import UserProfileModal from '../components/UserProfileModal';
import EmojiPicker from '../components/EmojiPicker';

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
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
function fmtRelative(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return fmtTime(iso);
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function Chat() {
  const me = useStore((s) => s.me)!;
  const online = useStore((s) => s.online);
  const markOnline = useStore((s) => s.markOnline);
  const setMe = useStore((s) => s.setMe);
  const setOnline = useStore((s) => s.setOnline);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const conn = useStore((s) => s.conn);

  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [dialogsLoaded, setDialogsLoaded] = useState(false);
  const [activePeer, setActivePeer] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showPeerProfile, setShowPeerProfile] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef(0);
  const typingTimeout = useRef<any>(null);
  const peerTypingTimeout = useRef<any>(null);
  const activePeerRef = useRef<User | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { activePeerRef.current = activePeer; }, [activePeer]);

  async function loadDialogs() {
    try {
      const d = await api<Dialog[]>('/dialogs');
      setDialogs(d);
    } catch {} finally { setDialogsLoaded(true); }
  }

  async function loadOnline() {
    try {
      const r = await api<{ users: number[] }>('/presence/online');
      setOnline(r.users);
    } catch {}
  }

  useEffect(() => {
    loadDialogs();
    loadOnline();
    wsClient.connect();
    const off = wsClient.on(handleWS);
    const onVis = () => { if (!document.hidden) loadOnline(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [text]);

  function handleWS(msg: any) {
    switch (msg.type) {
      case 'message:new': {
        const m: Message = msg.message;
        const peer = activePeerRef.current;
        const isActive = peer && (m.sender_id === peer.id || m.receiver_id === peer.id) && (m.sender_id === me.id || m.receiver_id === me.id);
        if (isActive) {
          setMessages((prev) => {
            if (msg.clientId) {
              const idx = prev.findIndex((x) => x.clientId === msg.clientId);
              if (idx >= 0) {
                const next = [...prev]; next[idx] = m; return next;
              }
            }
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          if (m.sender_id !== me.id) {
            wsClient.send('read', { peerId: m.sender_id });
          }
          setTimeout(() => scrollToBottom('smooth'), 0);
        }
        loadDialogs();
        break;
      }
      case 'message:updated': {
        const m: Message = msg.message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        loadDialogs();
        break;
      }
      case 'message:deleted': {
        const { id } = msg;
        setMessages((prev) => prev.filter((x) => x.id !== id));
        loadDialogs();
        break;
      }
      case 'typing': {
        const peer = activePeerRef.current;
        if (peer && msg.from === peer.id) {
          setPeerTyping(!!msg.isTyping);
          if (peerTypingTimeout.current) clearTimeout(peerTypingTimeout.current);
          if (msg.isTyping) {
            peerTypingTimeout.current = setTimeout(() => setPeerTyping(false), 4000);
          }
        }
        break;
      }
      case 'presence': {
        markOnline(msg.userId, msg.online);
        break;
      }
      case 'read': {
        const ids: number[] = msg.ids || [];
        if (!ids.length) return;
        setMessages((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, status: 'read' } : x)));
        loadDialogs();
        break;
      }
    }
  }

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  async function openChat(peer: User) {
    setActivePeer(peer);
    setMessages([]);
    setMessagesLoading(true);
    setHasMore(false);
    setPeerTyping(false);
    setEditingId(null);
    setMenuFor(null);
    setShowEmoji(false);
    try {
      const msgs = await api<Message[]>(`/dialogs/${peer.id}/messages?limit=30`);
      setMessages(msgs);
      setHasMore(msgs.length === 30);
      setTimeout(() => scrollToBottom('auto'), 0);
      await api(`/dialogs/${peer.id}/read`, { method: 'POST' });
      wsClient.send('read', { peerId: peer.id });
      loadDialogs();
    } catch {} finally { setMessagesLoading(false); }
  }

  async function loadMore() {
    if (!activePeer || !hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].id;
      const more = await api<Message[]>(`/dialogs/${activePeer.id}/messages?limit=30&before=${oldest}`);
      if (more.length === 0) { setHasMore(false); return; }
      const el = scrollRef.current;
      lastScrollHeight.current = el ? el.scrollHeight : 0;
      setMessages((prev) => [...more, ...prev]);
      setHasMore(more.length === 30);
      setTimeout(() => {
        if (el) el.scrollTop = el.scrollHeight - lastScrollHeight.current;
      }, 0);
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80 && hasMore && !loadingMore) loadMore();
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollDown(!nearBottom);
  }

  function send() {
    if (!activePeer || !text.trim()) return;
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: -Date.now(),
      sender_id: me.id,
      receiver_id: activePeer.id,
      content: text.trim(),
      status: 'sent',
      edited: false,
      created_at: new Date().toISOString(),
      clientId,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    wsClient.send('message:send', { to: activePeer.id, content: text.trim(), clientId });
    setText('');
    setShowEmoji(false);
    wsClient.send('typing', { to: activePeer.id, isTyping: false });
    setTimeout(() => scrollToBottom('smooth'), 0);
  }

  function onTextChange(v: string) {
    setText(v);
    if (!activePeer) return;
    wsClient.send('typing', { to: activePeer.id, isTyping: v.length > 0 });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (activePeer) wsClient.send('typing', { to: activePeer.id, isTyping: false });
    }, 2500);
  }

  function insertEmoji(e: string) {
    const ta = textareaRef.current;
    if (!ta) { setText(text + e); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + e + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + e.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function startEdit(m: Message) {
    setEditingId(m.id);
    setEditText(m.content);
    setMenuFor(null);
  }
  function saveEdit() {
    if (!editingId || !editText.trim()) return;
    wsClient.send('message:edit', { id: editingId, content: editText.trim() });
    setEditingId(null);
  }
  function delMsg(id: number, scope: 'me' | 'both') {
    wsClient.send('message:delete', { id, scope });
    setMenuFor(null);
  }

  async function doSearch(q: string) {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const r = await api<User[]>(`/users/search?q=${encodeURIComponent(q.trim())}`);
      setSearchResults(r);
    } catch {}
  }

  async function logout() {
    clearToken();
    wsClient.disconnect();
    setMe(null);
  }

  const peerOnline = activePeer ? online.has(activePeer.id) : false;
  const dialogList = useMemo(() => dialogs, [dialogs]);

  return (
    <div className="h-screen flex relative overflow-hidden">
      <div className="app-backdrop" />

      {/* Sidebar */}
      <aside className="w-80 border-r border-bg-line flex flex-col glass relative z-10">
        {/* Header */}
        <div className="p-3 border-b border-bg-line flex items-center gap-2">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 flex-1 min-w-0 p-1.5 rounded-xl hover:bg-bg-line/50 transition-colors"
          >
            <Avatar src={me.avatar_url} name={me.nickname} size={40} />
            <div className="text-left min-w-0">
              <div className="font-semibold truncate flex items-center gap-1.5">
                {me.nickname}
                <ConnPill conn={conn} />
              </div>
              <div className="text-xs text-ink-dim truncate">{me.email}</div>
            </div>
          </button>
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="w-9 h-9 rounded-lg text-ink-dim hover:text-ink hover:bg-bg-line/60 transition-all flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button onClick={logout} title="Logout" className="w-9 h-9 rounded-lg text-ink-dim hover:text-danger hover:bg-danger/10 transition-all flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <input
              className="input pl-9"
              placeholder="Search users…"
              value={search}
              onChange={(e) => doSearch(e.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-ink-mute hover:text-ink hover:bg-bg-line/60 flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Dialogs list */}
        <div className="flex-1 overflow-y-auto">
          {search.trim() ? (
            <div className="animate-fade-in">
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-ink-mute font-bold">Search results</div>
              {searchResults.length === 0 && (
                <div className="px-4 py-3 text-sm text-ink-dim">No users found.</div>
              )}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { openChat(u); setSearch(''); setSearchResults([]); }}
                  className="dlg-row"
                >
                  <Avatar src={u.avatar_url} name={u.nickname} size={40} online={online.has(u.id)} />
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-medium truncate">{u.nickname}</div>
                    <div className="text-xs text-ink-dim truncate">{u.bio || '—'}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {!dialogsLoaded && (
                <div className="px-3 py-2 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <div className="skeleton w-11 h-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-2/3" />
                        <div className="skeleton h-3 w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dialogsLoaded && dialogList.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-ink-dim animate-fade-in">
                  <div className="text-3xl mb-2">💬</div>
                  No conversations yet.<br />
                  <span className="text-ink-mute text-xs">Search for users above to start chatting.</span>
                </div>
              )}
              {dialogList.map((d) => {
                const isActive = activePeer?.id === d.peer_id;
                const unread = Number(d.unread) || 0;
                const isMine = d.last_sender === me.id;
                return (
                  <button
                    key={d.peer_id}
                    onClick={() => openChat({ id: d.peer_id, nickname: d.nickname, avatar_url: d.avatar_url, bio: d.bio, last_seen: d.last_seen })}
                    className={`dlg-row ${isActive ? 'active' : ''}`}
                  >
                    <Avatar src={d.avatar_url} name={d.nickname} size={44} online={online.has(d.peer_id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{d.nickname}</span>
                        <span className="text-[10px] text-ink-mute shrink-0">{fmtRelative(d.last_created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-xs truncate ${unread > 0 && !isMine ? 'text-ink' : 'text-ink-dim'}`}>
                          {isMine ? <span className="text-ink-mute">You: </span> : null}
                          {d.last_content}
                        </span>
                        {unread > 0 && !isMine ? (
                          <span className="shrink-0 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[20px] h-5 inline-flex items-center justify-center shadow-bubble"
                                style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)))' }}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : isMine ? (
                          <ReadTick status={d.last_status} small />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-bg-line text-[10px] text-ink-mute text-center">
          Pulse Messenger
        </div>
      </aside>

      {/* Chat panel */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {!activePeer ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <header className="px-5 py-3 border-b border-bg-line flex items-center gap-3 glass">
              <button onClick={() => setShowPeerProfile(true)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar src={activePeer.avatar_url} name={activePeer.nickname} size={42} online={peerOnline} />
                <div className="text-left">
                  <div className="font-semibold tracking-tight">{activePeer.nickname}</div>
                  <div className="text-xs h-4">
                    {peerTyping ? (
                      <span className="text-brand inline-flex items-center gap-1.5">
                        <span className="inline-flex gap-0.5">
                          <span className="typing-dot" style={{ animationDelay: '0ms' }}/>
                          <span className="typing-dot" style={{ animationDelay: '120ms' }}/>
                          <span className="typing-dot" style={{ animationDelay: '240ms' }}/>
                        </span>
                        typing
                      </span>
                    ) : peerOnline ? (
                      <span className="text-success inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />online
                      </span>
                    ) : (
                      <span className="text-ink-dim">last seen {fmtLastSeen(activePeer.last_seen)}</span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowPeerProfile(true)}
                title="View profile"
                className="w-9 h-9 rounded-lg text-ink-dim hover:text-ink hover:bg-bg-line/60 transition-all flex items-center justify-center"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-1 relative">
              {loadingMore && (
                <div className="text-center text-xs text-ink-mute py-2 inline-flex items-center gap-2 justify-center w-full">
                  <span className="w-3 h-3 border-2 border-ink-mute border-t-transparent rounded-full animate-spin" />
                  Loading earlier messages…
                </div>
              )}

              {messagesLoading && messages.length === 0 && (
                <div className="space-y-3 py-4 animate-fade-in">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                      <div className={`skeleton h-10 ${i % 2 ? 'w-40' : 'w-56'} rounded-2xl`} />
                    </div>
                  ))}
                </div>
              )}

              {messages.map((m, i) => {
                const mine = m.sender_id === me.id;
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const groupedWithPrev = prev && prev.sender_id === m.sender_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000 && !showDay;
                const groupedWithNext = next && next.sender_id === m.sender_id && (new Date(next.created_at).getTime() - new Date(m.created_at).getTime()) < 5 * 60 * 1000 &&
                  new Date(next.created_at).toDateString() === new Date(m.created_at).toDateString();

                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="sticky top-1 z-[1] flex justify-center my-4">
                        <span className="chip glass !backdrop-blur-md">{fmtDay(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group ${groupedWithPrev ? 'mt-0.5' : 'mt-2'}`}>
                      <div
                        className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'} ${m.pending ? 'opacity-70' : ''} ${
                          mine
                            ? groupedWithNext ? '!rounded-br-2xl' : ''
                            : groupedWithNext ? '!rounded-bl-2xl' : ''
                        }`}
                      >
                        {editingId === m.id ? (
                          <div className="min-w-[220px]">
                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-full bg-transparent outline-none resize-none text-sm"
                              rows={2}
                            />
                            <div className="flex gap-3 mt-1 text-xs">
                              <button onClick={saveEdit} className="font-semibold hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="opacity-80 hover:opacity-100">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        )}
                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${mine ? 'text-white/75' : 'text-ink-mute'} justify-end leading-none`}>
                          {m.edited && <span className="italic">edited</span>}
                          <span>{fmtTime(m.created_at)}</span>
                          {mine && !m.pending && <ReadTick status={m.status} />}
                          {m.pending && (
                            <span className="w-3 h-3 border-[1.5px] border-white/70 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>

                        {!m.pending && editingId !== m.id && (
                          <div className={`absolute top-1 ${mine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button
                              onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                              className="w-7 h-7 rounded-lg hover:bg-bg-line/60 flex items-center justify-center text-ink-dim hover:text-ink"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                            </button>
                            {menuFor === m.id && (
                              <div className={`absolute z-10 ${mine ? 'right-0' : 'left-0'} top-8 w-44 card !rounded-xl overflow-hidden text-sm animate-scale-in`}>
                                {mine && (
                                  <button onClick={() => startEdit(m)} className="w-full text-left px-3 py-2 hover:bg-bg-line/60 inline-flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Edit
                                  </button>
                                )}
                                <button onClick={() => delMsg(m.id, 'me')} className="w-full text-left px-3 py-2 hover:bg-bg-line/60 inline-flex items-center gap-2">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                                  Delete for me
                                </button>
                                {mine && (
                                  <button onClick={() => delMsg(m.id, 'both')} className="w-full text-left px-3 py-2 hover:bg-danger/15 text-danger inline-flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                    Delete for both
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {peerTyping && (
                <div className="flex justify-start mt-2 animate-fade-in">
                  <div className="bubble bubble-theirs !py-2.5 inline-flex gap-1 items-center">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }}/>
                    <span className="typing-dot" style={{ animationDelay: '120ms' }}/>
                    <span className="typing-dot" style={{ animationDelay: '240ms' }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Scroll-to-bottom FAB */}
            {showScrollDown && (
              <button
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-24 right-6 w-11 h-11 rounded-full bg-bg-card border border-bg-line shadow-card hover:scale-110 transition-all flex items-center justify-center text-ink-dim hover:text-ink animate-pop-in"
                title="Scroll to bottom"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )}

            {/* Composer */}
            <div className="p-3 sm:p-4 border-t border-bg-line glass">
              <div className="flex items-end gap-2 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmoji((v) => !v)}
                    className="w-10 h-10 rounded-xl text-ink-dim hover:text-ink hover:bg-bg-line/60 transition-all flex items-center justify-center text-lg"
                    title="Emoji"
                  >
                    😊
                  </button>
                  {showEmoji && (
                    <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />
                  )}
                </div>

                <textarea
                  ref={textareaRef}
                  className="input resize-none overflow-y-auto py-2.5"
                  rows={1}
                  placeholder="Write a message…"
                  value={text}
                  onChange={(e) => onTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  style={{ maxHeight: 160 }}
                />

                <button
                  onClick={send}
                  disabled={!text.trim()}
                  className="btn-primary !px-3 !py-2.5 h-11 w-11 !rounded-xl"
                  title="Send (Enter)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
              <div className="text-[10px] text-ink-mute text-center mt-2 select-none">
                Press <kbd className="px-1.5 py-0.5 rounded bg-bg-line/60 text-ink-dim">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-bg-line/60 text-ink-dim">Shift</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-bg-line/60 text-ink-dim">Enter</kbd> for newline
              </div>
            </div>
          </>
        )}
      </main>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showPeerProfile && activePeer && <UserProfileModal userId={activePeer.id} onClose={() => setShowPeerProfile(false)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4 animate-fade-in">
      <div className="max-w-sm">
        <div
          className="mx-auto inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-5 shadow-bubble"
          style={{ backgroundImage: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-hover)) 60%, #3ddc97 130%)' }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Your messages</h2>
        <p className="text-ink-dim mt-2">Select a conversation or search for someone to start a new chat.</p>
      </div>
    </div>
  );
}

function ConnPill({ conn }: { conn: 'idle' | 'connecting' | 'online' | 'offline' }) {
  if (conn === 'online') return (
    <span title="Connected" className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
  );
  if (conn === 'connecting') return (
    <span title="Connecting…" className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse shrink-0" />
  );
  if (conn === 'offline') return (
    <span title="Offline — reconnecting" className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
  );
  return null;
}

function ReadTick({ status, small }: { status: 'sent' | 'delivered' | 'read'; small?: boolean }) {
  const s = small ? 12 : 14;
  const color = status === 'read' ? '#3ddc97' : 'currentColor';
  if (status === 'sent') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  return (
    <svg width={s + 4} height={s} viewBox="0 0 28 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 6 7 17 2 12"/>
      <polyline points="26 6 15 17 14 16"/>
    </svg>
  );
}
