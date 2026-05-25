import { getToken } from './api';

type Handler = (msg: any) => void;

class WSClient {
  ws: WebSocket | null = null;
  handlers = new Set<Handler>();
  reconnectTimer: any = null;
  closed = false;

  connect() {
    this.closed = false;
    const token = getToken();
    if (!token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      let msg: any; try { msg = JSON.parse(e.data); } catch { return; }
      this.handlers.forEach((h) => h(msg));
    };
    this.ws.onclose = () => {
      if (this.closed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 1500);
    };
    this.ws.onerror = () => { try { this.ws?.close(); } catch {} };
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }

  send(type: string, payload: any = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  on(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
}

export const wsClient = new WSClient();
