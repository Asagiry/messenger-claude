import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, nickname } = req.body || {};
  if (!email || !password || !nickname) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 4) return res.status(400).json({ error: 'Password too short' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) return res.status(400).json({ error: 'Invalid nickname (3-20 chars, a-z 0-9 _)' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users (email, password_hash, nickname) VALUES ($1,$2,$3) RETURNING id, email, nickname, avatar_url, bio',
      [email.toLowerCase(), hash, nickname]
    );
    const user = r.rows[0];
    res.json({ token: signToken(user.id), user });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email or nickname already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const r = await pool.query(
      'SELECT id, email, nickname, password_hash, avatar_url, bio FROM users WHERE lower(email) = lower($1) OR lower(nickname) = lower($1)',
      [login]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      token: signToken(u.id),
      user: { id: u.id, email: u.email, nickname: u.nickname, avatar_url: u.avatar_url, bio: u.bio },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT id, email, nickname, avatar_url, bio FROM users WHERE id = $1',
    [req.userId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

export default router;
