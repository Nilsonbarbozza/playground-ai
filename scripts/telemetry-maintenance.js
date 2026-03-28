import dotenv from 'dotenv';
import db from '../config/db.js';

dotenv.config();

function asInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  return { dryRun };
}

function moduleExpr(alias = 'cl') {
  return `CASE
    WHEN ${alias}.description ILIKE 'TOPUP:%' THEN 'topup'
    WHEN ${alias}.description ILIKE '%Text2Img%' THEN 'text2img'
    WHEN ${alias}.description ILIKE '%ImageEdit%' THEN 'image_edit'
    WHEN ${alias}.description ILIKE '%FaceSwap%' THEN 'faceswap'
    WHEN ${alias}.description ILIKE '%Video%' THEN 'video'
    WHEN ${alias}.description ILIKE 'REFUND:%' THEN 'refund'
    WHEN ${alias}.description ILIKE 'RELEASE:%' THEN 'release'
    WHEN ${alias}.description ILIKE 'RESERVE:%' THEN 'reserve'
    ELSE 'other'
  END`;
}

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS telemetry_events_daily (
      day DATE NOT NULL,
      event_name VARCHAR(120) NOT NULL,
      route_or_feature VARCHAR(180) NOT NULL DEFAULT 'unknown',
      source VARCHAR(40) NOT NULL DEFAULT 'web',
      total_events INTEGER NOT NULL DEFAULT 0,
      unique_actors INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day, event_name, route_or_feature, source)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS credit_ledger_daily (
      day DATE NOT NULL,
      module VARCHAR(64) NOT NULL DEFAULT 'other',
      movement_type VARCHAR(16) NOT NULL,
      total_credits INTEGER NOT NULL DEFAULT 0,
      total_events INTEGER NOT NULL DEFAULT 0,
      unique_users INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day, module, movement_type)
    )
  `);
}

async function aggregateTelemetryDaily(backfillDays) {
  const result = await db.query(
    `INSERT INTO telemetry_events_daily (
       day, event_name, route_or_feature, source, total_events, unique_actors, updated_at
     )
     SELECT
       DATE(te.created_at) AS day,
       te.event_name,
       COALESCE(te.route_or_feature, 'unknown') AS route_or_feature,
       COALESCE(te.source, 'web') AS source,
       COUNT(*)::int AS total_events,
       COUNT(DISTINCT COALESCE(te.user_id::text, te.session_id, 'anon'))::int AS unique_actors,
       NOW()
     FROM telemetry_events te
     WHERE te.created_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY DATE(te.created_at), te.event_name, COALESCE(te.route_or_feature, 'unknown'), COALESCE(te.source, 'web')
     ON CONFLICT (day, event_name, route_or_feature, source)
     DO UPDATE SET
       total_events = EXCLUDED.total_events,
       unique_actors = EXCLUDED.unique_actors,
       updated_at = NOW()
     RETURNING 1`,
    [backfillDays]
  );
  return result.rowCount || 0;
}

async function aggregateCreditsDaily(backfillDays) {
  const modExpr = moduleExpr('cl');
  const result = await db.query(
    `INSERT INTO credit_ledger_daily (
       day, module, movement_type, total_credits, total_events, unique_users, updated_at
     )
     SELECT
       DATE(cl.created_at) AS day,
       ${modExpr} AS module,
       CASE WHEN cl.amount < 0 THEN 'spent' ELSE 'added' END AS movement_type,
       ABS(SUM(cl.amount))::int AS total_credits,
       COUNT(*)::int AS total_events,
       COUNT(DISTINCT cl.user_id)::int AS unique_users,
       NOW()
     FROM credit_ledger cl
     WHERE cl.created_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY DATE(cl.created_at), ${modExpr}, CASE WHEN cl.amount < 0 THEN 'spent' ELSE 'added' END
     ON CONFLICT (day, module, movement_type)
     DO UPDATE SET
       total_credits = EXCLUDED.total_credits,
       total_events = EXCLUDED.total_events,
       unique_users = EXCLUDED.unique_users,
       updated_at = NOW()
     RETURNING 1`,
    [backfillDays]
  );
  return result.rowCount || 0;
}

async function purgeOldData({
  telemetryRetentionDays,
  telemetryDailyRetentionDays,
  creditDailyRetentionDays,
  creditLedgerRetentionDays
}) {
  const out = {};
  if (telemetryRetentionDays > 0) {
    const r = await db.query(
      `DELETE FROM telemetry_events
       WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [telemetryRetentionDays]
    );
    out.telemetry_events_deleted = r.rowCount || 0;
  }

  if (telemetryDailyRetentionDays > 0) {
    const r = await db.query(
      `DELETE FROM telemetry_events_daily
       WHERE day < CURRENT_DATE - $1::int`,
      [telemetryDailyRetentionDays]
    );
    out.telemetry_events_daily_deleted = r.rowCount || 0;
  }

  if (creditDailyRetentionDays > 0) {
    const r = await db.query(
      `DELETE FROM credit_ledger_daily
       WHERE day < CURRENT_DATE - $1::int`,
      [creditDailyRetentionDays]
    );
    out.credit_ledger_daily_deleted = r.rowCount || 0;
  }

  if (creditLedgerRetentionDays > 0) {
    const r = await db.query(
      `DELETE FROM credit_ledger
       WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [creditLedgerRetentionDays]
    );
    out.credit_ledger_deleted = r.rowCount || 0;
  }

  return out;
}

async function run() {
  const { dryRun } = parseArgs();
  const backfillDays = asInt(process.env.TELEMETRY_AGG_BACKFILL_DAYS, 45);
  const telemetryRetentionDays = asInt(process.env.TELEMETRY_RETENTION_DAYS, 180);
  const telemetryDailyRetentionDays = asInt(process.env.TELEMETRY_DAILY_RETENTION_DAYS, 730);
  const creditDailyRetentionDays = asInt(process.env.CREDIT_DAILY_RETENTION_DAYS, 1460);
  const creditLedgerRetentionDays = asInt(process.env.CREDIT_LEDGER_RETENTION_DAYS, 0);

  try {
    await ensureSchema();

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dry_run: true,
            config: {
              backfillDays,
              telemetryRetentionDays,
              telemetryDailyRetentionDays,
              creditDailyRetentionDays,
              creditLedgerRetentionDays
            }
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    const telemetryUpserts = await aggregateTelemetryDaily(backfillDays);
    const creditsUpserts = await aggregateCreditsDaily(backfillDays);
    const purged = await purgeOldData({
      telemetryRetentionDays,
      telemetryDailyRetentionDays,
      creditDailyRetentionDays,
      creditLedgerRetentionDays
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: false,
          aggregated: {
            telemetry_daily_upserts: telemetryUpserts,
            credit_daily_upserts: creditsUpserts
          },
          purged,
          config: {
            backfillDays,
            telemetryRetentionDays,
            telemetryDailyRetentionDays,
            creditDailyRetentionDays,
            creditLedgerRetentionDays
          },
          finished_at: new Date().toISOString()
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  } finally {
    try {
      await db.pool.end();
    } catch {
      // noop
    }
  }
}

run();
