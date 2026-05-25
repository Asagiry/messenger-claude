import { pool } from './pool';
import bcrypt from 'bcryptjs';

const USERS = [
  { nick: 'alice',   email: 'alice@example.com',   pass: 'alice',   bio: 'Designer & coffee enthusiast.', avatar: 'https://i.pravatar.cc/200?img=1' },
  { nick: 'bob',     email: 'bob@example.com',     pass: 'bob',     bio: 'Backend dev. Loves PostgreSQL.', avatar: 'https://i.pravatar.cc/200?img=12' },
  { nick: 'carol',   email: 'carol@example.com',   pass: 'carol',   bio: 'Frontend wizard.',              avatar: 'https://i.pravatar.cc/200?img=5' },
  { nick: 'dave',    email: 'dave@example.com',    pass: 'dave',    bio: 'DevOps & cloud.',               avatar: 'https://i.pravatar.cc/200?img=15' },
  { nick: 'eve',     email: 'eve@example.com',     pass: 'eve',     bio: 'Security researcher.',          avatar: 'https://i.pravatar.cc/200?img=9' },
  { nick: 'frank',   email: 'frank@example.com',   pass: 'frank',   bio: 'Mobile developer.',             avatar: 'https://i.pravatar.cc/200?img=33' },
  { nick: 'grace',   email: 'grace@example.com',   pass: 'grace',   bio: 'Product manager.',              avatar: 'https://i.pravatar.cc/200?img=20' },
  { nick: 'henry',   email: 'henry@example.com',   pass: 'henry',   bio: 'Data scientist.',               avatar: 'https://i.pravatar.cc/200?img=52' },
  { nick: 'ivy',     email: 'ivy@example.com',     pass: 'ivy',     bio: 'UI/UX designer.',               avatar: 'https://i.pravatar.cc/200?img=47' },
  { nick: 'jack',    email: 'jack@example.com',    pass: 'jack',    bio: 'Full-stack engineer.',          avatar: 'https://i.pravatar.cc/200?img=60' },
];

// pairs of [sender_nick, receiver_nick, text]
const DIALOGS: [string, string, string][] = [
  // alice <-> bob
  ['alice', 'bob', 'Hey Bob! How is the backend refactor going?'],
  ['bob', 'alice', 'Hey Alice! Almost done, just polishing the query layer.'],
  ['alice', 'bob', 'Nice. Can you send me the migration file later?'],
  ['bob', 'alice', 'Sure, will share it tonight.'],
  ['alice', 'bob', 'Thanks 🙌'],
  ['bob', 'alice', 'BTW, do you have the new design mock?'],
  ['alice', 'bob', 'Yes! I will drop it in your inbox.'],

  // carol <-> dave
  ['carol', 'dave', 'Dave, can you spin up a staging env?'],
  ['dave', 'carol', 'On it. Will ping you in 10.'],
  ['carol', 'dave', 'Perfect, ty.'],
  ['dave', 'carol', 'Staging is up: staging.app.local'],
  ['carol', 'dave', 'Got it, testing now.'],
  ['carol', 'dave', 'Looks great 👍'],

  // eve <-> frank
  ['eve', 'frank', 'Did you patch the auth bug?'],
  ['frank', 'eve', 'Yes — pushed to main an hour ago.'],
  ['eve', 'frank', 'I will run a quick pentest after lunch.'],
  ['frank', 'eve', 'Sounds good. Send me the report when ready.'],
  ['eve', 'frank', 'Will do.'],

  // grace <-> henry
  ['grace', 'henry', 'Quarterly metrics ready?'],
  ['henry', 'grace', 'Almost. Need a few more hours.'],
  ['grace', 'henry', 'No rush — EOD is fine.'],
  ['henry', 'grace', 'Cool, thanks!'],
  ['grace', 'henry', 'Could you also include the churn chart?'],
  ['henry', 'grace', 'Already in the deck.'],
];

(async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reset
      await client.query('TRUNCATE messages RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE users RESTART IDENTITY CASCADE');

      const ids: Record<string, number> = {};
      for (const u of USERS) {
        const hash = await bcrypt.hash(u.pass, 10);
        const r = await client.query(
          'INSERT INTO users (email, password_hash, nickname, avatar_url, bio) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [u.email, hash, u.nick, u.avatar, u.bio]
        );
        ids[u.nick] = r.rows[0].id;
      }

      // Insert messages with slight time offsets
      let t = Date.now() - DIALOGS.length * 60_000;
      for (const [s, r, text] of DIALOGS) {
        await client.query(
          `INSERT INTO messages (sender_id, receiver_id, content, status, created_at)
           VALUES ($1,$2,$3,'read', to_timestamp($4 / 1000.0))`,
          [ids[s], ids[r], text, t]
        );
        t += 60_000 + Math.floor(Math.random() * 120_000);
      }

      await client.query('COMMIT');
      console.log(`Seeded ${USERS.length} users and ${DIALOGS.length} messages.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
