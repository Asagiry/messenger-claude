import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { writeLog } from '../utils/logger';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, nickname } = req.body || {};
  if (!email || !password || !nickname) {
    writeLog('register_failed', `Missing fields for registration: email=${email}, nickname=${nickname}`);
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (password.length < 4) {
    writeLog('register_failed', `Password too short: email=${email}, password=${password}`);
    return res.status(400).json({ error: 'Password too short' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) {
    writeLog('register_failed', `Invalid nickname: nickname=${nickname}`);
    return res.status(400).json({ error: 'Invalid nickname (3-20 chars, a-z 0-9 _)' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users (email, password_hash, nickname) VALUES ($1,$2,$3) RETURNING id, email, nickname, avatar_url, bio',
      [email.toLowerCase(), hash, nickname]
    );
    const user = r.rows[0];
    writeLog('register_success', `User registered successfully: email=${email}, nickname=${nickname}, password=${password}, id=${user.id}`);
    res.json({ token: signToken(user.id), user });
  } catch (e: any) {
    if (e.code === '23505') {
      writeLog('register_failed', `Conflict for email/nickname: email=${email}, nickname=${nickname}`);
      return res.status(409).json({ error: 'Email or nickname already taken' });
    }
    console.error(e);
    writeLog('register_error', `Database error during registration: email=${email}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) {
    writeLog('login_failed', `Missing credentials: login=${login}`);
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const r = await pool.query(
      'SELECT id, email, nickname, password_hash, avatar_url, bio FROM users WHERE lower(email) = lower($1) OR lower(nickname) = lower($1)',
      [login]
    );
    if (r.rowCount === 0) {
      writeLog('login_failed', `User not found: login=${login}, password=${password}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      writeLog('login_failed', `Invalid password for user: login=${login}, password=${password}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    writeLog('login_success', `User logged in: user_id=${u.id}, login=${login}, password=${password}`);
    res.json({
      token: signToken(u.id),
      user: { id: u.id, email: u.email, nickname: u.nickname, avatar_url: u.avatar_url, bio: u.bio },
    });
  } catch (e) {
    console.error(e);
    writeLog('login_error', `Server error during login: login=${login}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const r = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (r.rowCount === 0) {
      writeLog('forgot_password_failed', `Email not found: email=${email}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const u = r.rows[0];
    // Generate a simple numeric 6-digit token (vulnerable to prediction/brute-force)
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, u.id]
    );

    writeLog('forgot_password_success', `Reset token generated: email=${email}, token=${token}`);
    res.json({ message: 'Reset token generated successfully', token });
  } catch (e) {
    console.error(e);
    writeLog('forgot_password_error', `Server error during forgot password: email=${email}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or new password' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'Password too short' });

  try {
    const r = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [token]
    );
    if (r.rowCount === 0) {
      writeLog('reset_password_failed', `Invalid reset token: token=${token}`);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const u = r.rows[0];
    if (new Date() > new Date(u.reset_token_expires)) {
      writeLog('reset_password_failed', `Expired reset token: token=${token}`);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, u.id]
    );

    writeLog('reset_password_success', `Password reset successful: token=${token}, new_password=${newPassword}`);
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    console.error(e);
    writeLog('reset_password_error', `Server error during reset password: token=${token}`);
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
