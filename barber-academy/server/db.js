import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { config } from './config.js';
import { TOPICS, DEFAULT_SETTINGS } from './content.js';

export const db = new DatabaseSync(path.join(config.dataDir, 'academy.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  manual_access INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  terms_accepted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  external_id TEXT,
  customer_id TEXT,
  current_period_end INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  diagram TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  tools TEXT NOT NULL DEFAULT '[]',
  tips TEXT NOT NULL DEFAULT '[]',
  mistakes TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT 'shembull',
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  join_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, received_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

// Përmbajtja fillestare. Mësimet e shtuara në versione të reja (v: 2…) futen një herë
// edhe në databazat ekzistuese, pa prekur ato që ke ndryshuar ose fshirë.
const CONTENT_VERSION = 2;
{
  const fresh = db.prepare('SELECT COUNT(*) AS n FROM topics').get().n === 0;
  const done = Number(db.prepare("SELECT value FROM settings WHERE key = 'content_version'").get()?.value || (fresh ? 0 : 1));
  const ins = db.prepare(`INSERT OR IGNORE INTO topics (section, slug, title, summary, intro, diagram, steps, tools, tips, mistakes, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  TOPICS.forEach((t, i) => {
    if ((t.v || 1) <= done) return;
    ins.run(t.section, t.slug, t.title, t.summary, t.intro, t.diagram || null,
      JSON.stringify(t.steps || []), JSON.stringify(t.tools || []), JSON.stringify(t.tips || []),
      JSON.stringify(t.mistakes || []), i);
  });
  db.prepare("INSERT INTO settings (key, value) VALUES ('content_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(CONTENT_VERSION));
}
{
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
}

export function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function parseTopic(row) {
  if (!row) return row;
  const j = (s) => { try { return JSON.parse(s); } catch { return []; } };
  return { ...row, steps: j(row.steps), tools: j(row.tools), tips: j(row.tips), mistakes: j(row.mistakes) };
}

// Mbyll databazën mirë kur ndalet serveri
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { db.close(); } catch {} process.exit(0); });
