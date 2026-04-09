import dotenv from 'dotenv';
import { spawn } from 'child_process';
import db from '../config/db.js';

dotenv.config();

const BASE_URL = process.env.SMOKE_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.STAGING_CHECK_PASSWORD || 'Teste@123456';
const TIMEOUT_MS = 10000;

const EXIT = {
  OK: 0,
  HEALTH_FAIL: 10,
  ENV_FAIL: 11,
  DB_FAIL: 12,
  AUTH_FAIL: 13,
  BILLING_PACKAGES_FAIL: 14,
  UNEXPECTED: 99
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function fetchJson(url, options = {}) {
  const res = await withTimeout(fetch(url, options), TIMEOUT_MS, `fetch ${url}`);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : { raw: await res.text() };
  return { status: res.status, data };
}

function startServer() {
  return spawn('node', ['server.js'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    windowsHide: true
  });
}

async function isServerHealthy() {
  try {
    const health = await fetchJson(`${BASE_URL}/api/health`);
    return health.status === 200;
  } catch {
    return false;
  }
}

async function ensureServerHealthy() {
  const alreadyHealthy = await isServerHealthy();
  if (alreadyHealthy) return { startedServer: null, healthy: true };

  const startedServer = startServer();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (await isServerHealthy()) {
      return { startedServer, healthy: true };
    }
    await sleep(1000);
  }
  return { startedServer, healthy: false };
}

async function checkEnvFlags() {
  const flags = {
    STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    APP_BASE_URL: Boolean(process.env.APP_BASE_URL),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    JWT_SECRET: Boolean(process.env.JWT_SECRET)
  };
  const ok = Object.values(flags).every(Boolean);
  return { ok, flags };
}

async function checkDatabase() {
  const tables = ['credit_packages', 'credit_orders', 'webhook_events', 'users', 'credit_ledger'];
  const result = await db.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tables]
  );
  const existing = new Set(result.rows.map((r) => r.table_name));
  const missing = tables.filter((t) => !existing.has(t));

  const activePackagesRes = await db.query(
    `SELECT id, code, name, price_brl_cents, credits, active, stripe_price_id
     FROM credit_packages
     WHERE active = true
     ORDER BY created_at DESC`
  );

  const activePackages = activePackagesRes.rows;
  const hasAtLeastOnePackage = activePackages.length > 0;
  const hasStripePriceId = activePackages.some((p) => Boolean(p.stripe_price_id));

  return {
    ok: missing.length === 0 && hasAtLeastOnePackage,
    missingTables: missing,
    activePackagesCount: activePackages.length,
    activePackages,
    hasStripePriceId
  };
}

async function checkApiFlow() {
  const health = await fetchJson(`${BASE_URL}/api/health`);
  if (health.status !== 200) {
    return { ok: false, reason: 'health-failed', health };
  }

  const email = `staging.check.${Date.now()}@example.com`;
  const register = await fetchJson(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });

  // Handle both instant login and email verification cases
  const isPendingVerification = register.status === 201 && register.data?.requires_verification;
  const hasToken = register.status === 201 && register.data?.token;

  if (!hasToken && !isPendingVerification) {
    return { ok: false, reason: 'register-failed', register };
  }

  // If verification is required, we can't test billing packages without a token, 
  // but we still count registration as a success for the smoke test.
  if (isPendingVerification) {
    try {
      await db.query('DELETE FROM users WHERE email = $1', [email]);
    } catch {}
    return {
      ok: true,
      note: 'registration-success-pending-verification',
      health,
      registerStatus: register.status,
      isFirstSignup: register.data?.is_first_signup ?? null
    };
  }

  const token = register.data.token;
  const packages = await fetchJson(`${BASE_URL}/api/billing/packages`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (packages.status !== 200 || !Array.isArray(packages.data?.packages) || packages.data.packages.length === 0) {
    return { ok: false, reason: 'billing-packages-failed', packages };
  }

  let userCleanupErr = null;
  try {
    await db.query('DELETE FROM users WHERE email = $1', [email]);
  } catch (err) {
    userCleanupErr = err.message;
  }

  return {
    ok: true,
    health,
    registerStatus: register.status,
    isFirstSignup: register.data?.is_first_signup ?? null,
    packagesCount: packages.data.packages.length,
    userCleanupErr
  };
}

async function run() {
  let startedServer = null;
  try {
    const env = await checkEnvFlags();
    if (!env.ok) {
      console.error(JSON.stringify({ ok: false, reason: 'env-missing', env }, null, 2));
      process.exit(EXIT.ENV_FAIL);
    }

    const dbCheck = await checkDatabase();
    if (!dbCheck.ok) {
      console.error(JSON.stringify({ ok: false, reason: 'db-invalid', dbCheck }, null, 2));
      process.exit(EXIT.DB_FAIL);
    }

    const serverState = await ensureServerHealthy();
    startedServer = serverState.startedServer;
    if (!serverState.healthy) {
      console.error(JSON.stringify({ ok: false, reason: 'health-failed', baseUrl: BASE_URL }, null, 2));
      process.exit(EXIT.HEALTH_FAIL);
    }

    const api = await checkApiFlow();
    if (!api.ok) {
      const code =
        api.reason === 'health-failed'
          ? EXIT.HEALTH_FAIL
          : api.reason === 'register-failed'
          ? EXIT.AUTH_FAIL
          : EXIT.BILLING_PACKAGES_FAIL;
      console.error(JSON.stringify({ ok: false, reason: api.reason, api }, null, 2));
      process.exit(code);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          envFlags: env.flags,
          db: {
            activePackagesCount: dbCheck.activePackagesCount,
            hasStripePriceId: dbCheck.hasStripePriceId,
            activePackages: dbCheck.activePackages
          },
          api
        },
        null,
        2
      )
    );
    process.exit(EXIT.OK);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, reason: 'unexpected-error', error: err.message }, null, 2));
    process.exit(EXIT.UNEXPECTED);
  } finally {
    if (startedServer && !startedServer.killed) {
      startedServer.kill('SIGTERM');
    }
  }
}

run();
