import { pool } from './pool';

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_nickname_idx ON users (lower(nickname));

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_for_sender BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_for_both BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recv_idx ON messages (receiver_id, sender_id, created_at DESC);
`;

(async () => {
  try {
    await pool.query(SQL);
    console.log('Migrations applied.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
