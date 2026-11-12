import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 30;
export const COOKIE = 'ba_sid';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const expected = Buffer.from(h, 'base64');
  const got = await scrypt(password, Buffer.from(s, 'base64'), expected.length);
  return crypto.timingSafeEqual(got, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha256(token), userId, expires);
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: SESSION_DAYS * 864e5, path: '/',
  });
}

export function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** Lidh përdoruesin e kyçur me req.user (ose null). */
export function loadUser(req, _res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE);
  if (token) {
    const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now());
    if (row) req.user = row;
  }
  next();
}

export function subscriptionFor(email) {
  return db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(email) || null;
}

/** A ka akses në përmbajtje: admini, akses manual, ose abonim aktiv. */
export function hasAccess(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.manual_access) return true;
  const sub = subscriptionFor(user.email);
  if (!sub || sub.status !== 'active') return false;
  // 3 ditë tolerancë pas skadimit të periudhës (vonesa të webhook-ut)
  if (sub.current_period_end && sub.current_period_end * 1000 < Date.now() - 3 * 864e5) return false;
  return true;
}

export const requireUser = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Duhet të hysh në llogari.' });

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Vetëm administratori.' });

export const requireAccess = (req, res, next) =>
  hasAccess(req.user) ? next() : res.status(402).json({ error: 'Kërkohet abonim aktiv.' });

/** Krijon (ose përditëson) llogarinë e administratorit nga .env */
export async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) {
    if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
      console.warn('⚠  Nuk ka administrator. Vendos ADMIN_EMAIL dhe ADMIN_PASSWORD te .env dhe rinise serverin.');
    }
    return;
  }
  if (config.adminPassword.length < 10) {
    console.warn('⚠  ADMIN_PASSWORD duhet të ketë të paktën 10 karaktere.');
    return;
  }
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(config.adminEmail);
  if (!existing) {
    db.prepare(`INSERT INTO users (name, email, password_hash, role, terms_accepted_at) VALUES (?,?,?,'admin',datetime('now'))`)
      .run('Administrator', config.adminEmail, await hashPassword(config.adminPassword));
    console.log(`✔  U krijua llogaria e administratorit: ${config.adminEmail}`);
  } else if (existing.role !== 'admin') {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  }
}

// Kufizim i thjeshtë i kërkesave (kundër sulmeve me fjalëkalime)
const buckets = new Map();
export function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return next(); }
    if (++b.n > max) return res.status(429).json({ error: 'Shumë përpjekje. Provo përsëri pas pak minutash.' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}, 10 * 60 * 1000).unref();
