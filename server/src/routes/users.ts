import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/search', async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const r = await pool.query(
    `SELECT id, nickname, avatar_url, bio, last_seen
     FROM users
     WHERE lower(nickname) LIKE $1 AND id <> $2
     ORDER BY nickname LIMIT 20`,
    [`%${q.toLowerCase()}%`, req.userId]
  );
  res.json(r.rows);
});

router.get('/:id', async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Bad id' });
  const r = await pool.query(
    'SELECT id, nickname, avatar_url, bio, last_seen FROM users WHERE id = $1',
    [id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

router.patch('/me', async (req: AuthRequest, res) => {
  const { nickname, avatar_url, bio, password } = req.body || {};
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (nickname !== undefined) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) return res.status(400).json({ error: 'Invalid nickname' });
    updates.push(`nickname = $${i++}`); values.push(nickname);
  }
  if (avatar_url !== undefined) { updates.push(`avatar_url = $${i++}`); values.push(avatar_url); }
  if (bio !== undefined) { updates.push(`bio = $${i++}`); values.push(bio); }
  if (password) {
    if (password.length < 4) return res.status(400).json({ error: 'Password too short' });
    const hash = await bcrypt.hash(password, 10);
    updates.push(`password_hash = $${i++}`); values.push(hash);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.userId);
  try {
    const r = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, nickname, avatar_url, bio`,
      values
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Nickname already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
