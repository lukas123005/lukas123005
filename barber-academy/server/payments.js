// Abonimi mujor: Whop (parazgjedhur) ose Stripe.
// Aksesi lidhet me EMAIL-in: anëtari duhet të paguajë me të njëjtin email me të cilin u regjistrua.
import crypto from 'node:crypto';
import { db, getSettings } from './db.js';
import { config } from './config.js';

export function upsertSubscription({ email, provider, status, externalId = null, customerId = null, periodEnd = null }) {
  if (!email) return;
  db.prepare(`INSERT INTO subscriptions (email, provider, status, external_id, customer_id, current_period_end, updated_at)
    VALUES (?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(email) DO UPDATE SET provider=excluded.provider, status=excluded.status,
      external_id=COALESCE(excluded.external_id, external_id), customer_id=COALESCE(excluded.customer_id, customer_id),
      current_period_end=COALESCE(excluded.current_period_end, current_period_end), updated_at=datetime('now')`)
    .run(email.trim().toLowerCase(), provider, status, externalId, customerId, periodEnd);
}

/** Ruaj ID-në e eventit — i njëjti webhook nuk përpunohet dy herë. */
function firstTime(id) {
  if (!id) return true;
  const r = db.prepare('INSERT OR IGNORE INTO webhook_events (id) VALUES (?)').run(id);
  return r.changes === 1;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function findEmail(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (/email/i.test(k) && typeof v === 'string' && v.includes('@')) return v;
  }
  for (const v of Object.values(obj)) {
    const found = findEmail(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// ───────────────────────────── WHOP ─────────────────────────────
// Whop përdor standardin "Standard Webhooks": headers webhook-id, webhook-timestamp, webhook-signature.
function verifyWhop(raw, headers) {
  const secret = config.whop.webhookSecret;
  if (!secret) return false;
  const id = headers['webhook-id'], ts = headers['webhook-timestamp'], sigHeader = headers['webhook-signature'];
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const signed = `${id}.${ts}.${raw.toString('utf8')}`;
  const keys = [Buffer.from(secret, 'utf8')];
  if (secret.startsWith('whsec_')) keys.push(Buffer.from(secret.slice(6), 'base64'));
  else keys.push(Buffer.from(secret, 'base64'));
  const given = sigHeader.split(' ').map((p) => p.split(',')[1]).filter(Boolean);
  return keys.some((key) => {
    const expected = crypto.createHmac('sha256', key).update(signed).digest('base64');
    return given.some((g) => safeEqual(g, expected));
  });
}

export function whopWebhook(req, res) {
  if (!verifyWhop(req.body, req.headers)) return res.status(401).send('invalid signature');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('bad json'); }
  if (!firstTime(`whop:${req.headers['webhook-id']}`)) return res.send('ok');

  const type = String(event.type || event.action || '');
  const data = event.data || {};
  const email = findEmail(data);
  const validRe = /(went_valid|membership\.activated|payment\.succeeded)/;
  const invalidRe = /(went_invalid|membership\.deactivated|membership\.expired|membership\.cancel)/;
  if (email && validRe.test(type)) {
    upsertSubscription({ email, provider: 'whop', status: 'active', externalId: data.id || null });
  } else if (email && invalidRe.test(type)) {
    upsertSubscription({ email, provider: 'whop', status: 'inactive', externalId: data.id || null });
  }
  console.log(`[whop] ${type} ${email ? '(email ok)' : '(pa email)'}`);
  res.send('ok');
}

// ───────────────────────────── STRIPE ─────────────────────────────
async function stripe(method, path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`);
  return json;
}

function verifyStripe(raw, header) {
  const secret = config.stripe.webhookSecret;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!parts.t || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw.toString('utf8')}`).digest('hex');
  return sigs.some((s) => safeEqual(s, expected));
}

async function emailForCustomer(customerId) {
  const row = db.prepare('SELECT email FROM subscriptions WHERE customer_id = ?').get(customerId)
    || db.prepare('SELECT email FROM users WHERE stripe_customer_id = ?').get(customerId);
  if (row) return row.email;
  try { return (await stripe('GET', `/customers/${encodeURIComponent(customerId)}`)).email; } catch { return null; }
}

export async function stripeWebhook(req, res) {
  if (!verifyStripe(req.body, req.headers['stripe-signature'])) return res.status(401).send('invalid signature');
  const event = JSON.parse(req.body.toString('utf8'));
  if (!firstTime(`stripe:${event.id}`)) return res.send('ok');
  const obj = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
      const email = obj.customer_details?.email || obj.customer_email;
      upsertSubscription({ email, provider: 'stripe', status: 'active', externalId: obj.subscription, customerId: obj.customer });
      if (obj.client_reference_id) {
        db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(obj.customer, Number(obj.client_reference_id));
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const email = await emailForCustomer(obj.customer);
      const active = ['active', 'trialing'].includes(obj.status) && event.type !== 'customer.subscription.deleted';
      const periodEnd = obj.current_period_end || obj.items?.data?.[0]?.current_period_end || null;
      upsertSubscription({ email, provider: 'stripe', status: active ? 'active' : 'inactive', externalId: obj.id, customerId: obj.customer, periodEnd });
    }
  } catch (e) {
    console.error('[stripe] gabim:', e.message);
    return res.status(500).send('error');
  }
  res.send('ok');
}

// ───────────────────── Checkout / menaxhimi ─────────────────────
export async function checkoutUrl(user) {
  if (config.provider === 'stripe') {
    if (!config.stripe.secretKey || !config.stripe.priceId) throw new Error('Stripe nuk është konfiguruar ende.');
    const params = {
      mode: 'subscription',
      'line_items[0][price]': config.stripe.priceId,
      'line_items[0][quantity]': '1',
      success_url: `${config.baseUrl}/#/llogaria?pagesa=ok`,
      cancel_url: `${config.baseUrl}/#/abonimi`,
      client_reference_id: String(user.id),
      allow_promotion_codes: 'true',
    };
    if (user.stripe_customer_id) params.customer = user.stripe_customer_id;
    else params.customer_email = user.email;
    return (await stripe('POST', '/checkout/sessions', params)).url;
  }
  const url = getSettings().checkout_url || config.whop.checkoutUrl;
  if (!url) throw new Error('Linku i pagesës (Whop) nuk është vendosur ende.');
  return url;
}

export async function manageUrl(user) {
  if (config.provider === 'stripe') {
    const customer = user.stripe_customer_id || db.prepare('SELECT customer_id FROM subscriptions WHERE email = ?').get(user.email)?.customer_id;
    if (!customer) throw new Error('Nuk u gjet asnjë abonim Stripe për këtë llogari.');
    return (await stripe('POST', '/billing_portal/sessions', { customer, return_url: `${config.baseUrl}/#/llogaria` })).url;
  }
  return getSettings().manage_url || 'https://whop.com/';
}

/** Kur fshihet llogaria: anulo abonimin Stripe (Whop anulohet nga vetë anëtari në Whop). */
export async function cancelForDeletedUser(user) {
  if (config.provider !== 'stripe' || !config.stripe.secretKey) return;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE email = ? AND provider = ?').get(user.email, 'stripe');
  if (sub?.external_id && sub.status === 'active') {
    try { await stripe('DELETE', `/subscriptions/${encodeURIComponent(sub.external_id)}`); } catch (e) { console.error(e.message); }
  }
}
