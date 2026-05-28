import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { writeLog } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

async function downloadAvatar(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Storing uploads in server/uploads (served as static at /uploads)
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const extension = path.extname(url).split('?')[0] || '.png';
    const filename = `avatar_${Date.now()}_${Math.round(Math.random() * 1e9)}${extension}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);
    
    return `/uploads/${filename}`;
  } catch (error: any) {
    console.error('Failed to download avatar:', error);
    writeLog('avatar_download_failed', `Failed to download avatar from URL: ${url}, error: ${error.message}`);
    return url; // fallback to original URL
  }
}

router.get('/search', async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  writeLog('user_search', `userId=${req.userId}, query=${q}`);
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
  if (avatar_url !== undefined) {
    let finalUrl = avatar_url;
    if (avatar_url && (avatar_url.startsWith('http://') || avatar_url.startsWith('https://'))) {
      writeLog('avatar_download_start', `Downloading avatar URL: ${avatar_url}`);
      finalUrl = await downloadAvatar(avatar_url);
    }
    updates.push(`avatar_url = $${i++}`); 
    values.push(finalUrl);
  }
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
    writeLog('profile_update_success', `User updated profile: userId=${req.userId}, fields=${updates.join(', ')}`);
    res.json(r.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Nickname already taken' });
    console.error(e);
    writeLog('profile_update_error', `Database error updating profile for userId=${req.userId}`);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
