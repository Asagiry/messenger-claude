import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { verifyToken } from '../middleware/auth';
import { pool } from '../db/pool';

interface Client {
  userId: number;
  ws: WebSocket;
}

const clients = new Map<number, Set<WebSocket>>();

function send(ws: WebSocket, type: string, payload: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function sendTo(userId: number, type: string, payload: any) {
  const set = clients.get(userId);
  if (!set) return;
  for (const ws of set) send(ws, type, payload);
}

function isOnline(userId: number) {
  return clients.has(userId) && clients.get(userId)!.size > 0;
}

async function broadcastPresence(userId: number, online: boolean) {
  // Notify peers who share a dialog
  const r = await pool.query(
    `SELECT DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer
     FROM messages WHERE sender_id = $1 OR receiver_id = $1`,
    [userId]
  );
  for (const row of r.rows) {
    sendTo(row.peer, 'presence', { userId, online });
  }
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const userId = verifyToken(token);
    if (!userId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (!clients.has(userId)) clients.set(userId, new Set());
    const wasOffline = clients.get(userId)!.size === 0;
    clients.get(userId)!.add(ws);

    if (wasOffline) {
      await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]);
      broadcastPresence(userId, true).catch(console.error);
    }

    send(ws, 'hello', { userId });

    ws.on('message', async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      try {
        switch (msg.type) {
          case 'message:send': {
            const { to, content, clientId } = msg;
            const peer = parseInt(to, 10);
            const text = String(content || '').trim();
            if (!peer || !text) return;

            const peerCheck = await pool.query('SELECT 1 FROM users WHERE id = $1', [peer]);
            if (peerCheck.rowCount === 0) return;

            const initialStatus = isOnline(peer) ? 'delivered' : 'sent';
            const r = await pool.query(
              `INSERT INTO messages (sender_id, receiver_id, content, status)
               VALUES ($1,$2,$3,$4)
               RETURNING id, sender_id, receiver_id, content, status, edited, created_at, edited_at`,
              [userId, peer, text, initialStatus]
            );
            const m = r.rows[0];
            // Send back to sender (all devices) with clientId for matching
            sendTo(userId, 'message:new', { message: m, clientId });
            // Send to peer
            sendTo(peer, 'message:new', { message: m });
            break;
          }
          case 'message:edit': {
            const { id, content } = msg;
            const text = String(content || '').trim();
            if (!id || !text) return;
            const r = await pool.query(
              `UPDATE messages SET content = $1, edited = TRUE, edited_at = NOW()
               WHERE id = $2 AND sender_id = $3 AND deleted_for_both = FALSE
               RETURNING id, sender_id, receiver_id, content, status, edited, edited_at, created_at`,
              [text, id, userId]
            );
            if (r.rowCount === 0) return;
            const m = r.rows[0];
            sendTo(m.sender_id, 'message:updated', { message: m });
            sendTo(m.receiver_id, 'message:updated', { message: m });
            break;
          }
          case 'message:delete': {
            const { id, scope } = msg; // scope: 'me' | 'both'
            if (!id) return;
            const own = await pool.query(
              'SELECT sender_id, receiver_id FROM messages WHERE id = $1',
              [id]
            );
            if (own.rowCount === 0) return;
            const row = own.rows[0];
            if (row.sender_id !== userId && row.receiver_id !== userId) return;

            if (scope === 'both') {
              if (row.sender_id !== userId) return; // only sender can delete for both
              await pool.query('UPDATE messages SET deleted_for_both = TRUE WHERE id = $1', [id]);
              sendTo(row.sender_id, 'message:deleted', { id, scope: 'both' });
              sendTo(row.receiver_id, 'message:deleted', { id, scope: 'both' });
            } else {
              // delete for me — mark deleted_for_sender if user is sender, otherwise treat as receiver-side hide
              if (row.sender_id === userId) {
                await pool.query('UPDATE messages SET deleted_for_sender = TRUE WHERE id = $1', [id]);
              }
              sendTo(userId, 'message:deleted', { id, scope: 'me' });
            }
            break;
          }
          case 'typing': {
            const { to, isTyping } = msg;
            const peer = parseInt(to, 10);
            if (!peer) return;
            sendTo(peer, 'typing', { from: userId, isTyping: !!isTyping });
            break;
          }
          case 'read': {
            const { peerId } = msg;
            const peer = parseInt(peerId, 10);
            if (!peer) return;
            const r = await pool.query(
              `UPDATE messages SET status = 'read'
               WHERE receiver_id = $1 AND sender_id = $2 AND status <> 'read'
               RETURNING id`,
              [userId, peer]
            );
            const ids = r.rows.map((x) => x.id);
            if (ids.length) {
              sendTo(peer, 'read', { by: userId, ids });
              sendTo(userId, 'read', { by: userId, ids });
            }
            break;
          }
        }
      } catch (e) {
        console.error('WS handler error:', e);
      }
    });

    ws.on('close', async () => {
      const set = clients.get(userId);
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) {
        clients.delete(userId);
        await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]).catch(() => {});
        broadcastPresence(userId, false).catch(console.error);
      }
    });

    ws.on('error', () => {});
  });
}

export function getOnlineUsers(): number[] {
  return Array.from(clients.keys());
}
