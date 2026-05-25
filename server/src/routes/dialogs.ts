import { Router } from 'express';
import { pool } from '../db/pool';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// List of dialogs: distinct peers + last message + unread count
router.get('/', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const sql = `
    WITH visible AS (
      SELECT *,
        CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer_id
      FROM messages
      WHERE (sender_id = $1 OR receiver_id = $1)
        AND deleted_for_both = FALSE
        AND NOT (sender_id = $1 AND deleted_for_sender = TRUE)
    ),
    last_msgs AS (
      SELECT DISTINCT ON (peer_id) peer_id, id, sender_id, receiver_id, content, status, created_at, edited
      FROM visible
      ORDER BY peer_id, created_at DESC
    )
    SELECT
      u.id AS peer_id, u.nickname, u.avatar_url, u.bio, u.last_seen,
      lm.id AS last_id, lm.sender_id AS last_sender, lm.content AS last_content,
      lm.status AS last_status, lm.created_at AS last_created_at, lm.edited AS last_edited,
      (SELECT COUNT(*) FROM messages m
        WHERE m.receiver_id = $1 AND m.sender_id = u.id
          AND m.status <> 'read' AND m.deleted_for_both = FALSE) AS unread
    FROM last_msgs lm
    JOIN users u ON u.id = lm.peer_id
    ORDER BY lm.created_at DESC;
  `;
  const r = await pool.query(sql, [me]);
  res.json(r.rows);
});

// History with peer, paginated by "before" message id
router.get('/:peerId/messages', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const peer = parseInt(String(req.params.peerId), 10);
  if (isNaN(peer)) return res.status(400).json({ error: 'Bad id' });
  const before = req.query.before ? parseInt(String(req.query.before), 10) : null;
  const limit = Math.min(parseInt(String(req.query.limit || '30'), 10), 100);

  const params: any[] = [me, peer];
  let beforeSQL = '';
  if (before && !isNaN(before)) {
    params.push(before);
    beforeSQL = `AND id < $${params.length}`;
  }
  params.push(limit);

  const sql = `
    SELECT id, sender_id, receiver_id, content, status, edited, edited_at, created_at,
           deleted_for_sender, deleted_for_both
    FROM messages
    WHERE deleted_for_both = FALSE
      AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
      AND NOT (sender_id = $1 AND deleted_for_sender = TRUE)
      ${beforeSQL}
    ORDER BY id DESC
    LIMIT $${params.length}
  `;
  const r = await pool.query(sql, params);
  // Return ascending order
  res.json(r.rows.reverse());
});

// Mark all messages from peer as read
router.post('/:peerId/read', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const peer = parseInt(String(req.params.peerId), 10);
  if (isNaN(peer)) return res.status(400).json({ error: 'Bad id' });
  const r = await pool.query(
    `UPDATE messages SET status = 'read'
     WHERE receiver_id = $1 AND sender_id = $2 AND status <> 'read'
     RETURNING id`,
    [me, peer]
  );
  res.json({ updated: r.rows.map((x) => x.id) });
});

export default router;
