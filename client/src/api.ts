const TOKEN_KEY = 'msg_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface User {
  id: number;
  email?: string;
  nickname: string;
  avatar_url: string;
  bio: string;
  last_seen?: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  edited: boolean;
  edited_at?: string | null;
  created_at: string;
  deleted_for_sender?: boolean;
  deleted_for_both?: boolean;
  clientId?: string;
  pending?: boolean;
}

export interface Dialog {
  peer_id: number;
  nickname: string;
  avatar_url: string;
  bio: string;
  last_seen: string;
  last_id: number;
  last_sender: number;
  last_content: string;
  last_status: 'sent' | 'delivered' | 'read';
  last_created_at: string;
  last_edited: boolean;
  unread: string | number;
}
