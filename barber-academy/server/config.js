import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Lexo .env nëse ekziston (Node 22 e ka të integruar)
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* s'ka .env */ }

const env = process.env;
const dataDir = path.resolve(ROOT, env.DATA_DIR || './data');
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
  port: Number(env.PORT || 3000),
  baseUrl: (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, ''),
  dataDir,
  uploadDir,
  cookieSecure: env.COOKIE_SECURE === '1' || env.NODE_ENV === 'production',
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 2048),
  adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || '',
  provider: (env.PAYMENT_PROVIDER || 'whop').trim().toLowerCase(),
  whop: {
    checkoutUrl: env.WHOP_CHECKOUT_URL || '',
    webhookSecret: env.WHOP_WEBHOOK_SECRET || '',
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    priceId: env.STRIPE_PRICE_ID || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  },
};
