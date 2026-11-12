import { config, ROOT } from './config.js';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, getSettings, setSetting, parseTopic } from './db.js';
import { SECTIONS, DEFAULT_SETTINGS } from './content.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, loadUser, hasAccess, subscriptionFor,
  requireUser, requireAdmin, requireAccess, ensureAdmin, rateLimit,
} from './auth.js';
import { whopWebhook, stripeWebhook, checkoutUrl, manageUrl, cancelForDeletedUser } from './payments.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ───────────────────────── Siguria ─────────────────────────
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (config.cookieSecure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Webhook-et kanë nevojë për trupin "raw" për verifikimin e nënshkrimit
app.post('/webhooks/whop', express.raw({ type: '*/*', limit: '1mb' }), whopWebhook);
app.post('/webhooks/stripe', express.raw({ type: '*/*', limit: '1mb' }), a(stripeWebhook));

app.use(express.json({ limit: '300kb' }));
app.use(loadUser);

// Mbrojtje CSRF: çdo ndryshim në /api duhet të vijë nga faqja jonë (header i personalizuar + origin)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return res.status(403).json({ error: 'Kërkesë e pavlefshme.' });
  const origin = req.get('Origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}` && origin !== config.baseUrl) {
    return res.status(403).json({ error: 'Origjinë e pavlefshme.' });
  }
  next();
});

// ───────────────────────── Ndihmës ─────────────────────────
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lines = (v, max = 60) => (Array.isArray(v) ? v : String(v || '').split('\n'))
  .map((s) => str(String(s), 1000)).filter(Boolean).slice(0, max);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const isHttpUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `tema-${Date.now()}`;

function publicUser(u) {
  if (!u) return null;
  const sub = subscriptionFor(u.email);
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, access: hasAccess(u), manual_access: !!u.manual_access,
    subscription: sub ? { provider: sub.provider, status: sub.status, current_period_end: sub.current_period_end } : null,
    created_at: u.created_at,
  };
}
const mediaOut = (m) => ({ id: m.id, topic_id: m.topic_id, kind: m.kind, title: m.title, description: m.description, tag: m.tag, mime: m.mime, size: m.size, created_at: m.created_at, url: `/media/${m.id}` });

// ───────────────────────── Publike ─────────────────────────
app.get('/api/public', (req, res) => {
  const topics = db.prepare(`SELECT t.id, t.section, t.slug, t.title, t.summary, t.diagram,
      (SELECT COUNT(*) FROM media m WHERE m.topic_id = t.id AND m.kind='photo') AS photos,
      (SELECT COUNT(*) FROM media m WHERE m.topic_id = t.id AND m.kind='video') AS videos
    FROM topics t ORDER BY t.sort_order, t.id`).all();
  const upcoming = db.prepare(`SELECT id, title, starts_at, duration_min FROM meetings
    WHERE datetime(starts_at, '+' || duration_min || ' minutes') >= datetime('now') ORDER BY starts_at LIMIT 3`).all();
  res.json({ settings: getSettings(), sections: SECTIONS, topics, upcoming, provider: config.provider, user: publicUser(req.user) });
});

app.post('/api/register', rateLimit('register', 10, 60 * 60e3), a(async (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 254).toLowerCase(), password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Shkruaj emrin.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email i pavlefshëm.' });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere.' });
  if (req.body.acceptTerms !== true) return res.status(400).json({ error: 'Duhet të pranosh Kushtet dhe Politikën e Privatësisë.' });
  if (req.body.ageConfirm !== true) return res.status(400).json({ error: 'Duhet të konfirmosh moshën.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Ky email është i regjistruar. Hyr në llogari.' });
  const r = db.prepare(`INSERT INTO users (name, email, password_hash, terms_accepted_at) VALUES (?,?,?,datetime('now'))`)
    .run(name, email, await hashPassword(password));
  createSession(res, Number(r.lastInsertRowid));
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)) });
}));

app.post('/api/login', rateLimit('login', 15, 15 * 60e3), a(async (req, res) => {
  const email = str(req.body.email, 254).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = user ? await verifyPassword(String(req.body.password || ''), user.password_hash) : false;
  if (!ok) return res.status(401).json({ error: 'Email ose fjalëkalim i gabuar.' });
  createSession(res, user.id);
  res.json({ user: publicUser(user) });
}));

app.post('/api/logout', (req, res) => { destroySession(req, res); res.json({ ok: true }); });

app.post('/api/contact', rateLimit('contact', 5, 60 * 60e3), (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 254), phone = str(req.body.phone, 40), message = str(req.body.message, 3000);
  if (req.body.website) return res.json({ ok: true }); // fushë-kurth për robotët
  if (!name || !EMAIL_RE.test(email) || message.length < 5) return res.status(400).json({ error: 'Plotëso emrin, email-in dhe mesazhin.' });
  if (req.body.consent !== true) return res.status(400).json({ error: 'Duhet të pranosh përpunimin e të dhënave për t’u përgjigjur.' });
  db.prepare('INSERT INTO messages (name, email, phone, message) VALUES (?,?,?,?)').run(name, email, phone, message);
  res.json({ ok: true });
});

// ───────────────────────── Anëtarët ─────────────────────────
app.get('/api/me', (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/topics/:slug', (req, res) => {
  const t = parseTopic(db.prepare('SELECT * FROM topics WHERE slug = ?').get(req.params.slug));
  if (!t) return res.status(404).json({ error: 'Tema nuk u gjet.' });
  if (!hasAccess(req.user)) {
    return res.status(402).json({ error: 'Kërkohet abonim aktiv.', preview: { section: t.section, title: t.title, summary: t.summary, diagram: t.diagram, intro: t.intro } });
  }
  const media = db.prepare('SELECT * FROM media WHERE topic_id = ? ORDER BY created_at DESC, id DESC').all(t.id).map(mediaOut);
  res.json({ topic: t, media });
});

app.get('/api/meetings', requireUser, (req, res) => {
  const access = hasAccess(req.user);
  const rows = db.prepare('SELECT * FROM meetings ORDER BY starts_at DESC').all();
  res.json({ access, meetings: rows.map((m) => ({ ...m, join_url: access ? m.join_url : '' })) });
});

app.get('/api/meetings/:id/ics', requireUser, requireAccess, (req, res) => {
  const m = db.prepare('SELECT * FROM meetings WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).end();
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(m.starts_at), end = new Date(start.getTime() + m.duration_min * 60e3);
  const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barber Academy//SQ', 'BEGIN:VEVENT',
    `UID:meeting-${m.id}@barber-academy`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${icsEsc(m.title)}`, `DESCRIPTION:${icsEsc(`${m.description}\n${m.join_url}`)}`,
    m.join_url ? `URL:${m.join_url}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="takimi-${m.id}.ics"` }).send(ics);
});

app.post('/api/checkout', requireUser, a(async (req, res) => {
  try { res.json({ url: await checkoutUrl(req.user) }); } catch (e) { res.status(400).json({ error: e.message }); }
}));
app.post('/api/billing', requireUser, a(async (req, res) => {
  try { res.json({ url: await manageUrl(req.user) }); } catch (e) { res.status(400).json({ error: e.message }); }
}));

app.post('/api/me/password', requireUser, rateLimit('pw', 10, 15 * 60e3), a(async (req, res) => {
  const next = String(req.body.newPassword || '');
  if (!(await verifyPassword(String(req.body.currentPassword || ''), req.user.password_hash))) return res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar.' });
  if (next.length < (req.user.role === 'admin' ? 10 : 8)) return res.status(400).json({ error: 'Fjalëkalimi i ri është shumë i shkurtër.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  createSession(res, req.user.id);
  res.json({ ok: true });
}));

// E drejta e aksesit / transportueshmërisë së të dhënave
app.get('/api/me/export', requireUser, (req, res) => {
  const u = req.user;
  const data = {
    eksportuar_me: new Date().toISOString(),
    llogaria: { emri: u.name, email: u.email, regjistruar_me: u.created_at, kushtet_pranuar_me: u.terms_accepted_at },
    abonimi: subscriptionFor(u.email),
    mesazhet_e_kontaktit: db.prepare('SELECT name, email, phone, message, created_at FROM messages WHERE email = ?').all(u.email),
  };
  res.set('Content-Disposition', 'attachment; filename="te-dhenat-e-mia.json"').json(data);
});

// E drejta e fshirjes
app.delete('/api/me', requireUser, a(async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Llogaria e administratorit nuk fshihet nga këtu.' });
  if (!(await verifyPassword(String(req.body.password || ''), req.user.password_hash))) return res.status(400).json({ error: 'Fjalëkalimi është i gabuar.' });
  await cancelForDeletedUser(req.user);
  db.prepare('DELETE FROM messages WHERE email = ?').run(req.user.email);
  db.prepare('DELETE FROM subscriptions WHERE email = ? AND status != ?').run(req.user.email, 'active');
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  destroySession(req, res);
  res.json({ ok: true });
}));

// ───────────────────── Media (vetëm për abonentët) ─────────────────────
app.get('/media/:id', (req, res) => {
  if (!hasAccess(req.user)) return res.status(402).send('Kërkohet abonim aktiv.');
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).send('Nuk u gjet.');
  const file = path.join(config.uploadDir, path.basename(m.filename));
  res.sendFile(file, {
    headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': 'inline', 'Cross-Origin-Resource-Policy': 'same-origin' },
  }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ───────────────────────── Administratori ─────────────────────────
const ALLOWED = {
  'image/jpeg': { ext: '.jpg', kind: 'photo' }, 'image/png': { ext: '.png', kind: 'photo' },
  'image/webp': { ext: '.webp', kind: 'photo' }, 'image/gif': { ext: '.gif', kind: 'photo' },
  'video/mp4': { ext: '.mp4', kind: 'video' }, 'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
};
const TAGS = ['shembull', 'procesi', 'para', 'pas', 'gabim', 'zgjidhje', 'mjeti'];

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype].ext),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 20, fields: 20, fieldSize: 10000 },
  fileFilter: (_req, file, cb) => cb(null, !!ALLOWED[file.mimetype]),
});

function magicOk(file) {
  const fd = fs.openSync(file.path, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const ascii = (s, e) => b.toString('latin1', s, e);
  switch (file.mimetype) {
    case 'image/jpeg': return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png': return b.readUInt32BE(0) === 0x89504e47;
    case 'image/gif': return ascii(0, 4) === 'GIF8';
    case 'image/webp': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'video/webm': return b.readUInt32BE(0) === 0x1a45dfa3;
    case 'video/mp4': case 'video/quicktime': return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(ascii(4, 8));
    default: return false;
  }
}

app.post('/api/admin/media', requireUser, requireAdmin, (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Skedari është më i madh se ${config.maxUploadMb} MB.` : 'Ngarkimi dështoi.';
      return res.status(400).json({ error: msg });
    }
    const files = req.files || [];
    const topicId = Number(req.body.topic_id) || null;
    if (!files.length) return res.status(400).json({ error: 'Lejohen vetëm JPG, PNG, WEBP, GIF, MP4, WEBM dhe MOV.' });
    if (!topicId || !db.prepare('SELECT 1 FROM topics WHERE id = ?').get(topicId)) {
      files.forEach((f) => fs.rmSync(f.path, { force: true }));
      return res.status(400).json({ error: 'Tema nuk ekziston.' });
    }
    const tag = TAGS.includes(req.body.tag) ? req.body.tag : 'shembull';
    const created = [], rejected = [];
    const ins = db.prepare('INSERT INTO media (topic_id, kind, title, description, tag, filename, mime, size) VALUES (?,?,?,?,?,?,?,?)');
    for (const f of files) {
      if (!magicOk(f)) { fs.rmSync(f.path, { force: true }); rejected.push(f.originalname); continue; }
      const title = str(req.body.title, 120) || str(path.parse(Buffer.from(f.originalname, 'latin1').toString('utf8')).name, 120);
      const r = ins.run(topicId, ALLOWED[f.mimetype].kind, title, str(req.body.description, 2000), tag, f.filename, f.mimetype, f.size);
      created.push(mediaOut(db.prepare('SELECT * FROM media WHERE id = ?').get(r.lastInsertRowid)));
    }
    res.json({ created, rejected });
  });
});

app.patch('/api/admin/media/:id', requireUser, requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Nuk u gjet.' });
  const wanted = Number(req.body.topic_id);
  const topicId = wanted && db.prepare('SELECT 1 FROM topics WHERE id = ?').get(wanted) ? wanted : m.topic_id;
  db.prepare('UPDATE media SET title = ?, description = ?, tag = ?, topic_id = ? WHERE id = ?').run(
    req.body.title !== undefined ? str(req.body.title, 120) : m.title,
    req.body.description !== undefined ? str(req.body.description, 2000) : m.description,
    TAGS.includes(req.body.tag) ? req.body.tag : m.tag, topicId, m.id);
  res.json({ media: mediaOut(db.prepare('SELECT * FROM media WHERE id = ?').get(m.id)) });
});

function deleteMediaFiles(rows) {
  for (const m of rows) fs.rmSync(path.join(config.uploadDir, path.basename(m.filename)), { force: true });
}
app.delete('/api/admin/media/:id', requireUser, requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Nuk u gjet.' });
  db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  deleteMediaFiles([m]);
  res.json({ ok: true });
});

function topicFromBody(b) {
  const mistakes = (Array.isArray(b.mistakes) ? b.mistakes : lines(b.mistakes).map((l) => {
    const [problem, ...rest] = l.split('|');
    return { problem: problem.trim(), solution: rest.join('|').trim() };
  })).map((m) => ({ problem: str(m.problem, 600), solution: str(m.solution, 1000) })).filter((m) => m.problem).slice(0, 40);
  return {
    section: SECTIONS.some((s) => s.key === b.section) ? b.section : null,
    title: str(b.title, 120), summary: str(b.summary, 400), intro: str(b.intro, 4000),
    diagram: ['low', 'mid', 'high', 'burst', 'taper', 'drop', 'skin'].includes(b.diagram) ? b.diagram : null,
    steps: JSON.stringify(lines(b.steps)), tools: JSON.stringify(lines(b.tools)), tips: JSON.stringify(lines(b.tips)),
    mistakes: JSON.stringify(mistakes),
  };
}

app.post('/api/admin/topics', requireUser, requireAdmin, (req, res) => {
  const t = topicFromBody(req.body);
  if (!t.section || !t.title) return res.status(400).json({ error: 'Zgjidh seksionin dhe shkruaj titullin.' });
  let slug = slugify(t.title);
  while (db.prepare('SELECT 1 FROM topics WHERE slug = ?').get(slug)) slug += '-2';
  const order = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM topics').get().n;
  const r = db.prepare(`INSERT INTO topics (section, slug, title, summary, intro, diagram, steps, tools, tips, mistakes, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(t.section, slug, t.title, t.summary, t.intro, t.diagram, t.steps, t.tools, t.tips, t.mistakes, order);
  res.json({ topic: parseTopic(db.prepare('SELECT * FROM topics WHERE id = ?').get(r.lastInsertRowid)) });
});

app.put('/api/admin/topics/:id', requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM topics WHERE id = ?').get(id)) return res.status(404).json({ error: 'Nuk u gjet.' });
  const t = topicFromBody(req.body);
  if (!t.section || !t.title) return res.status(400).json({ error: 'Zgjidh seksionin dhe shkruaj titullin.' });
  db.prepare(`UPDATE topics SET section=?, title=?, summary=?, intro=?, diagram=?, steps=?, tools=?, tips=?, mistakes=?, updated_at=datetime('now') WHERE id=?`)
    .run(t.section, t.title, t.summary, t.intro, t.diagram, t.steps, t.tools, t.tips, t.mistakes, id);
  res.json({ topic: parseTopic(db.prepare('SELECT * FROM topics WHERE id = ?').get(id)) });
});

app.delete('/api/admin/topics/:id', requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  deleteMediaFiles(db.prepare('SELECT filename FROM media WHERE topic_id = ?').all(id));
  db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/overview', requireUser, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(publicUser);
  res.json({
    users,
    media: db.prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC').all().map(mediaOut),
    topics: db.prepare('SELECT * FROM topics ORDER BY sort_order, id').all().map(parseTopic),
    meetings: db.prepare('SELECT * FROM meetings ORDER BY starts_at DESC').all(),
    messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all(),
    settings: getSettings(),
    stats: {
      members: users.filter((u) => u.role !== 'admin').length,
      active: users.filter((u) => u.role !== 'admin' && u.access).length,
      unread: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').get().n,
    },
    config: {
      provider: config.provider, maxUploadMb: config.maxUploadMb, baseUrl: config.baseUrl,
      whopWebhook: !!config.whop.webhookSecret, stripeReady: !!(config.stripe.secretKey && config.stripe.priceId && config.stripe.webhookSecret),
    },
  });
});

app.post('/api/admin/meetings', requireUser, requireAdmin, (req, res) => {
  const title = str(req.body.title, 160), starts = new Date(String(req.body.starts_at || ''));
  const joinUrl = str(req.body.join_url, 600);
  if (!title || isNaN(starts)) return res.status(400).json({ error: 'Shkruaj titullin dhe datën/orën.' });
  if (joinUrl && !isHttpUrl(joinUrl)) return res.status(400).json({ error: 'Linku i Zoom duhet të fillojë me https://' });
  const duration = Math.min(Math.max(Number(req.body.duration_min) || 60, 10), 600);
  db.prepare('INSERT INTO meetings (title, description, starts_at, duration_min, join_url) VALUES (?,?,?,?,?)')
    .run(title, str(req.body.description, 3000), starts.toISOString(), duration, joinUrl);
  res.json({ ok: true });
});
app.delete('/api/admin/meetings/:id', requireUser, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM meetings WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.patch('/api/admin/users/:id', requireUser, requireAdmin, (req, res) => {
  db.prepare("UPDATE users SET manual_access = ? WHERE id = ? AND role != 'admin'").run(req.body.manual_access ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});
app.post('/api/admin/users/:id/reset-password', requireUser, requireAdmin, a(async (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role != 'admin'").get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Nuk u gjet.' });
  const temp = crypto.randomBytes(9).toString('base64url');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(temp), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  res.json({ password: temp });
}));
app.delete('/api/admin/users/:id', requireUser, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'").run(Number(req.params.id));
  res.json({ ok: true });
});

app.patch('/api/admin/messages/:id', requireUser, requireAdmin, (req, res) => {
  db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(req.body.is_read ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', requireUser, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.put('/api/admin/settings', requireUser, requireAdmin, (req, res) => {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (req.body[key] === undefined) continue;
    const v = str(req.body[key], key === 'about' ? 3000 : 600);
    if (['checkout_url', 'manage_url'].includes(key) && v && !isHttpUrl(v)) {
      return res.status(400).json({ error: 'Linqet duhet të fillojnë me https://' });
    }
    setSetting(key, v);
  }
  res.json({ settings: getSettings() });
});

// ───────────────────────── Faqet ligjore ─────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function legalPage(file) {
  return (req, res) => {
    const s = getSettings();
    const vars = {
      ...s,
      controller: s.legal_entity || s.owner_name,
      address: s.legal_address || s.city || '—',
      email: s.email || '—', phone: s.phone || '—',
      provider_name: config.provider === 'stripe' ? 'Stripe Payments Europe, Ltd.' : 'Whop, Inc.',
      provider_short: config.provider === 'stripe' ? 'Stripe' : 'Whop',
      updated: '12.11.2026',
    };
    const tpl = fs.readFileSync(path.join(ROOT, 'server', 'legal', file), 'utf8');
    const body = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(vars[k] ?? ''));
    const layout = fs.readFileSync(path.join(ROOT, 'server', 'legal', '_layout.html'), 'utf8');
    res.type('html').send(layout.replace(/\{\{brand_name\}\}/g, esc(s.brand_name)).replace('{{content}}', body));
  };
}
app.get('/privatesia', legalPage('privatesia.html'));
app.get('/kushtet', legalPage('kushtet.html'));
app.get('/cookies', legalPage('cookies.html'));

app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: '1h' }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ndodhi një gabim në server.' });
});

await ensureAdmin();
app.listen(config.port, () => console.log(`✂  Barber Academy po punon në ${config.baseUrl} (port ${config.port}, pagesa: ${config.provider})`));
