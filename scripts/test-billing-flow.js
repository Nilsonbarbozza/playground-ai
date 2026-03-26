import dotenv from 'dotenv';
import { spawn } from 'child_process';
import db from '../config/db.js';

dotenv.config();

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'Teste@123456';
const PROMPT =
  process.env.SMOKE_TEST_PROMPT || 'A cinematic photo of a red vintage car in sunset light';
const COST_TEXT_TO_IMAGE = Number(process.env.COST_TEXT_TO_IMAGE) || 1;
const KEEP_DATA = process.env.SMOKE_KEEP_DATA === '1';

const EXIT = {
  OK: 0,
  HEALTH_FAIL: 10,
  REGISTER_FAIL: 11,
  GENERATE_FAIL: 12,
  USER_NOT_FOUND: 13,
  BILLING_MISMATCH: 14,
  TX_NOT_CAPTURED: 15,
  PROJECT_NOT_FOUND: 16,
  UNEXPECTED: 99
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : { raw: await res.text() };
  return { status: res.status, data };
}

async function isServerHealthy() {
  try {
    const { status } = await fetchJson(`${BASE_URL}/api/health`);
    return status === 200;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy()) return true;
    await sleep(1000);
  }
  return false;
}

function startServer() {
  return spawn('node', ['server.js'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    windowsHide: true
  });
}

async function run() {
  let startedServer = null;
  const email = `smoke.billing.${Date.now()}@example.com`;
  let userIdForCleanup = null;

  try {
    const alreadyHealthy = await isServerHealthy();
    if (!alreadyHealthy) {
      startedServer = startServer();
      const healthy = await waitForHealth();
      if (!healthy) {
        console.error(JSON.stringify({ ok: false, reason: 'health-check-failed', baseUrl: BASE_URL }, null, 2));
        process.exit(EXIT.HEALTH_FAIL);
      }
    }

    const register = await fetchJson(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD })
    });

    if (register.status !== 201 || !register.data?.token) {
      console.error(
        JSON.stringify(
          { ok: false, reason: 'register-failed', status: register.status, response: register.data },
          null,
          2
        )
      );
      process.exit(EXIT.REGISTER_FAIL);
    }

    const token = register.data.token;
    const initialCredits = register.data.user?.credits;

    const generate = await fetchJson(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ prompt: PROMPT })
    });

    if (generate.status !== 200 || !generate.data?.success) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            reason: 'generate-failed',
            status: generate.status,
            response: generate.data
          },
          null,
          2
        )
      );
      process.exit(EXIT.GENERATE_FAIL);
    }

    const userRes = await db.query('SELECT id, credits FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.error(JSON.stringify({ ok: false, reason: 'user-not-found-after-generate', email }, null, 2));
      process.exit(EXIT.USER_NOT_FOUND);
    }

    const user = userRes.rows[0];
    userIdForCleanup = user.id;

    const txRes = await db.query(
      `SELECT operation_key, amount, status, description, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 3`,
      [user.id]
    );

    const latestTx = txRes.rows[0] || null;
    if (!latestTx || latestTx.status !== 'captured') {
      console.error(
        JSON.stringify(
          { ok: false, reason: 'captured-transaction-not-found', latestTx, transactions: txRes.rows },
          null,
          2
        )
      );
      process.exit(EXIT.TX_NOT_CAPTURED);
    }

    const expectedCredits = Number(initialCredits) - COST_TEXT_TO_IMAGE;
    if (Number(user.credits) !== expectedCredits) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            reason: 'credits-mismatch',
            initialCredits,
            expectedCredits,
            actualCredits: user.credits
          },
          null,
          2
        )
      );
      process.exit(EXIT.BILLING_MISMATCH);
    }

    const projectRes = await db.query(
      `SELECT id, module, image_url, created_at
       FROM projects
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (projectRes.rows.length === 0) {
      console.error(JSON.stringify({ ok: false, reason: 'project-not-found' }, null, 2));
      process.exit(EXIT.PROJECT_NOT_FOUND);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          email,
          initialCredits,
          currentCredits: user.credits,
          expectedCredits,
          transaction: latestTx,
          project: projectRes.rows[0]
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
    if (!KEEP_DATA && userIdForCleanup) {
      try {
        await db.query('DELETE FROM users WHERE id = $1', [userIdForCleanup]);
      } catch (cleanupErr) {
        console.error(`[SMOKE_CLEANUP_WARN] ${cleanupErr.message}`);
      }
    }

    if (startedServer && !startedServer.killed) {
      startedServer.kill('SIGTERM');
    }
  }
}

run();
