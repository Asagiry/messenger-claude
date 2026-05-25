import { useEffect, useMemo, useRef, useState } from 'react';
import { api, clearToken } from '../api';
import type { Dialog, Message, User } from '../api';
import { useStore } from '../store';
import { wsClient } from '../ws';
import Avatar from '../components/Avatar';
import ProfileModal from '../components/ProfileModal';
import UserProfileModal from '../components/UserProfileModal';

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
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
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

export default function Chat() {
  const me = useStore((s) => s.me)!;
  const online = useStore((s) => s.online);
  const markOnline = useStore((s) => s.markOnline);
  const setMe = useStore((s) => s.setMe);
  const setOnline = useStore((s) => s.setOnline);

  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [activePeer, setActivePeer] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef(0);
  const typingTimeout = useRef<any>(null);
  const peerTypingTimeout = useRef<any>(null);
  const activePeerRef = useRef<User | null>(null);
  useEffect(() => { activePeerRef.current = activePeer; }, [activePeer]);

  async function loadDialogs() {
    try {
      const d = await api<Dialog[]>('/dialogs');
      setDialogs(d);
    } catch {}
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

  function handleWS(msg: any) {
    switch (msg.type) {
      case 'message:new': {
        const m: Message = msg.message;
        const peer = activePeerRef.current;
        const isActive = peer && (m.sender_id === peer.id || m.receiver_id === peer.id) && (m.sender_id === me.id || m.receiver_id === me.id);
        if (isActive) {
          setMessages((prev) => {
            // dedupe by clientId or id
            if (msg.clientId) {
              const idx = prev.findIndex((x) => x.clientId === msg.clientId);
              if (idx >= 0) {
                const next = [...prev]; next[idx] = m; return next;
              }
            }
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          // If peer sent it to me and chat is open, mark read
          if (m.sender_id !== me.id) {
            wsClient.send('read', { peerId: m.sender_id });
          }
          // Scroll to bottom
          setTimeout(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }, 0);
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
        const { id, scope } = msg;
        if (scope === 'both') {
          setMessages((prev) => prev.filter((x) => x.id !== id));
        } else {
          setMessages((prev) => prev.filter((x) => x.id !== id));
        }
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

  async function openChat(peer: User) {
    setActivePeer(peer);
    setMessages([]);
    setHasMore(false);
    setPeerTyping(false);
    setEditingId(null);
    try {
      const msgs = await api<Message[]>(`/dialogs/${peer.id}/messages?limit=30`);
      setMessages(msgs);
      setHasMore(msgs.length === 30);
      setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      // mark read on server + notify via WS
      await api(`/dialogs/${peer.id}/read`, { method: 'POST' });
      wsClient.send('read', { peerId: peer.id });
      loadDialogs();
    } catch {}
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
    wsClient.send('typing', { to: activePeer.id, isTyping: false });
    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
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
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-bg-line flex flex-col bg-bg-soft/60">
        <div className="p-4 border-b border-bg-line flex items-center gap-3">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80">
            <Avatar src={me.avatar_url} name={me.nickname} size={40} />
            <div className="text-left min-w-0">
              <div className="font-semibold truncate">{me.nickname}</div>
              <div className="text-xs text-ink-dim truncate">{me.email}</div>
            </div>
          </button>
          <button onClick={logout} title="Logout" className="btn-ghost !p-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <input className="input pl-9" placeholder="Search users…" value={search} onChange={(e) => doSearch(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {search.trim() ? (
            <div>
              <div className="px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">Search results</div>
              {searchResults.length === 0 && <div className="px-4 py-3 text-sm text-ink-dim">No users found.</div>}
              {searchResults.map((u) => (
                <button key={u.id} onClick={() => { openChat(u); setSearch(''); setSearchResults([]); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-line/40 transition-colors">
                  <Avatar src={u.avatar_url} name={u.nickname} size={40} online={online.has(u.id)} />
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{u.nickname}</div>
                    <div className="text-xs text-ink-dim truncate">{u.bio || '—'}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {dialogList.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-ink-dim">
                  No conversations yet.<br />Search for users above to start chatting.
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${isActive ? 'bg-brand/15' : 'hover:bg-bg-line/40'}`}
                  >
                    <Avatar src={d.avatar_url} name={d.nickname} size={44} online={online.has(d.peer_id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{d.nickname}</span>
                        <span className="text-[10px] text-ink-mute shrink-0">{fmtTime(d.last_created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-ink-dim truncate">
                          {isMine ? <span className="text-ink-mute">You: </span> : null}
                          {d.last_content}
                        </span>
                        {unread > 0 && !isMine ? (
                          <span className="shrink-0 bg-brand text-white text-[10px] font-semibold rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center">{unread}</span>
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
      </aside>

      {/* Chat panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {!activePeer ? (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand/10 mb-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <h2 className="text-xl font-semibold">Your messages</h2>
              <p className="text-ink-dim mt-1 text-sm">Select a conversation or search for users to start.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="px-5 py-3 border-b border-bg-line flex items-center gap-3 bg-bg-soft/40 backdrop-blur">
              <button onClick={() => setShowPeerProfile(true)} className="flex items-center gap-3 hover:opacity-80">
                <Avatar src={activePeer.avatar_url} name={activePeer.nickname} size={40} online={peerOnline} />
                <div className="text-left">
                  <div className="font-semibold">{activePeer.nickname}</div>
                  <div className="text-xs text-ink-dim">
                    {peerTyping ? <span className="text-brand">typing…</span> : peerOnline ? 'online' : `last seen ${fmtLastSeen(activePeer.last_seen)}`}
                  </div>
                </div>
              </button>
            </header>

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {loadingMore && <div className="text-center text-xs text-ink-mute py-2">Loading…</div>}
              {messages.map((m, i) => {
                const mine = m.sender_id === me.id;
                const prev = messages[i - 1];
                const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="text-center my-3"><span className="chip">{fmtDay(m.created_at)}</span></div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`relative max-w-[70%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-brand text-white rounded-br-md' : 'bg-bg-card text-ink rounded-bl-md border border-bg-line'} ${m.pending ? 'opacity-70' : ''}`}>
                        {editingId === m.id ? (
                          <div className="min-w-[200px]">
                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                              className="w-full bg-transparent outline-none resize-none text-sm"
                              rows={2}
                            />
                            <div className="flex gap-2 mt-1 text-xs">
                              <button onClick={saveEdit} className="hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="opacity-70 hover:opacity-100">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</div>
                        )}
                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-ink-mute'} justify-end`}>
                          {m.edited && <span>edited</span>}
                          <span>{fmtTime(m.created_at)}</span>
                          {mine && !m.pending && <ReadTick status={m.status} />}
                          {m.pending && <span>…</span>}
                        </div>

                        {!m.pending && editingId !== m.id && (
                          <div className={`absolute top-1 ${mine ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="p-1 rounded hover:bg-bg-line/60">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                            </button>
                            {menuFor === m.id && (
                              <div className={`absolute z-10 ${mine ? 'right-0' : 'left-0'} top-7 w-40 card !rounded-lg overflow-hidden text-sm`}>
                                {mine && <button onClick={() => startEdit(m)} className="w-full text-left px-3 py-2 hover:bg-bg-line/60">Edit</button>}
                                <button onClick={() => delMsg(m.id, 'me')} className="w-full text-left px-3 py-2 hover:bg-bg-line/60">Delete for me</button>
                                {mine && <button onClick={() => delMsg(m.id, 'both')} className="w-full text-left px-3 py-2 hover:bg-bg-line/60 text-danger">Delete for both</button>}
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
                <div className="flex justify-start">
                  <div className="bg-bg-card border border-bg-line rounded-2xl px-3 py-2 text-ink-dim text-sm inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '120ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '240ms' }}></span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-bg-line bg-bg-soft/40">
              <div className="flex items-end gap-2">
                <textarea
                  className="input resize-none max-h-32"
                  rows={1}
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => onTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button onClick={send} disabled={!text.trim()} className="btn-primary !px-3 !py-2 h-10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
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
  // delivered or read: double check
  return (
    <svg width={s + 4} height={s} viewBox="0 0 28 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 6 7 17 2 12"/>
      <polyline points="26 6 15 17 14 16"/>
    </svg>
  );
}
