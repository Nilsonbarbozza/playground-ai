import db from '../config/db.js';

export class TelemetryAnalyticsRepository {
  static moduleFromCreditDescriptionExpr(alias = 'cl') {
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

  static async getFunnel(rangeHours) {
    const result = await db.query(
      `SELECT event_name, COUNT(*)::int AS total
       FROM telemetry_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
         AND event_name IN (
           'topup_modal_opened',
           'topup_modal_closed',
           'topup_cta_clicked',
           'topup_checkout_started',
           'topup_checkout_returned_success',
           'topup_checkout_returned_cancel',
           'topup_order_paid',
           'topup_order_not_paid'
         )
       GROUP BY event_name`,
      [rangeHours]
    );
    return result.rows;
  }

  static async getTopViews(rangeHours, limit = 10) {
    const result = await db.query(
      `SELECT COALESCE(view_id, route_or_feature, 'unknown') AS view_id, COUNT(*)::int AS total
       FROM telemetry_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
         AND event_name = 'view_opened'
       GROUP BY COALESCE(view_id, route_or_feature, 'unknown')
       ORDER BY total DESC
       LIMIT $2`,
      [rangeHours, limit]
    );
    return result.rows;
  }

  static async getTopFeatures(rangeHours, limit = 10) {
    const result = await db.query(
      `SELECT COALESCE(route_or_feature, view_id, 'unknown') AS feature, COUNT(*)::int AS total
       FROM telemetry_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
         AND event_name NOT IN ('view_opened', 'api_error', 'ui_error', 'provider_error')
       GROUP BY COALESCE(route_or_feature, view_id, 'unknown')
       ORDER BY total DESC
       LIMIT $2`,
      [rangeHours, limit]
    );
    return result.rows;
  }

  static async getErrorsByModule(rangeHours, limit = 10) {
    const result = await db.query(
      `SELECT
         COALESCE(route_or_feature, 'unknown') AS module,
         event_name,
         COUNT(*)::int AS total
       FROM telemetry_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
         AND event_name IN ('api_error', 'ui_error', 'provider_error')
       GROUP BY COALESCE(route_or_feature, 'unknown'), event_name
       ORDER BY total DESC
       LIMIT $2`,
      [rangeHours, limit]
    );
    return result.rows;
  }

  static async getRecentInteractions({
    rangeHours,
    limit = 100,
    email = null,
    eventName = null,
    routeOrFeature = null,
    dateFrom = null,
    dateTo = null
  }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const where = [];
    const values = [];
    let p = 1;

    if (dateFrom) {
      where.push(`te.created_at >= $${p++}::timestamp`);
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push(`te.created_at <= $${p++}::timestamp`);
      values.push(dateTo);
    }
    if (!dateFrom && !dateTo) {
      where.push(`te.created_at >= NOW() - ($${p++}::int * INTERVAL '1 hour')`);
      values.push(rangeHours);
    }
    if (email) {
      where.push(`u.email ILIKE $${p++}`);
      values.push(`%${email}%`);
    }
    if (eventName) {
      where.push(`te.event_name ILIKE $${p++}`);
      values.push(`%${eventName}%`);
    }
    if (routeOrFeature) {
      where.push(`COALESCE(te.route_or_feature, te.view_id, '') ILIKE $${p++}`);
      values.push(`%${routeOrFeature}%`);
    }

    values.push(safeLimit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
         te.id,
         te.event_name,
         te.user_id,
         u.email AS user_email,
         te.session_id,
         te.view_id,
         te.route_or_feature,
         te.level,
         te.error_code,
         te.error_message_short,
         te.source,
         te.props,
         te.created_at
       FROM telemetry_events te
       LEFT JOIN users u ON u.id = te.user_id
       ${whereSql}
       ORDER BY te.created_at DESC
       LIMIT $${p}`,
      values
    );
    return result.rows;
  }

  static async getCreditUsageByModule(rangeHours, limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const moduleExpr = this.moduleFromCreditDescriptionExpr('cl');
    const result = await db.query(
      `SELECT
         ${moduleExpr} AS module,
         COALESCE(SUM(CASE WHEN cl.amount < 0 THEN -cl.amount ELSE 0 END), 0)::int AS credits_spent,
         COALESCE(SUM(CASE WHEN cl.amount > 0 THEN cl.amount ELSE 0 END), 0)::int AS credits_added,
         COUNT(*)::int AS events_count
       FROM credit_ledger cl
       WHERE cl.created_at >= NOW() - ($1::int * INTERVAL '1 hour')
       GROUP BY ${moduleExpr}
       ORDER BY credits_spent DESC, events_count DESC
       LIMIT $2`,
      [rangeHours, safeLimit]
    );
    return result.rows;
  }

  static async getCreditMovements({
    rangeHours,
    limit = 200,
    email = null,
    module = null,
    dateFrom = null,
    dateTo = null
  }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const moduleExpr = this.moduleFromCreditDescriptionExpr('cl');
    const where = [];
    const values = [];
    let p = 1;

    if (dateFrom) {
      where.push(`cl.created_at >= $${p++}::timestamp`);
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push(`cl.created_at <= $${p++}::timestamp`);
      values.push(dateTo);
    }
    if (!dateFrom && !dateTo) {
      where.push(`cl.created_at >= NOW() - ($${p++}::int * INTERVAL '1 hour')`);
      values.push(rangeHours);
    }
    if (email) {
      where.push(`u.email ILIKE $${p++}`);
      values.push(`%${email}%`);
    }
    if (module) {
      where.push(`${moduleExpr} ILIKE $${p++}`);
      values.push(`%${module}%`);
    }

    values.push(safeLimit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
         cl.id,
         cl.created_at,
         cl.user_id,
         u.email AS user_email,
         cl.amount,
         CASE WHEN cl.amount < 0 THEN 'spent' ELSE 'added' END AS movement_type,
         ${moduleExpr} AS module,
         cl.description
       FROM credit_ledger cl
       LEFT JOIN users u ON u.id = cl.user_id
       ${whereSql}
       ORDER BY cl.created_at DESC
       LIMIT $${p}`,
      values
    );
    return result.rows;
  }

  static async getTopCreditSpenders(rangeHours, limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const result = await db.query(
      `SELECT
         cl.user_id,
         u.email AS user_email,
         COALESCE(SUM(CASE WHEN cl.amount < 0 THEN -cl.amount ELSE 0 END), 0)::int AS credits_spent
       FROM credit_ledger cl
       LEFT JOIN users u ON u.id = cl.user_id
       WHERE cl.created_at >= NOW() - ($1::int * INTERVAL '1 hour')
       GROUP BY cl.user_id, u.email
       ORDER BY credits_spent DESC
       LIMIT $2`,
      [rangeHours, safeLimit]
    );
    return result.rows;
  }

  static async getTopupExperimentByVariant(rangeHours) {
    const result = await db.query(
      `SELECT
         COALESCE(NULLIF(te.props->>'ab_variant', ''), 'unknown') AS ab_variant,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_modal_opened')::int AS modal_opened,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_checkout_started')::int AS checkout_started,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_checkout_returned_success')::int AS checkout_success_return,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_checkout_returned_cancel')::int AS checkout_cancel_return,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_order_paid')::int AS order_paid,
         COUNT(*) FILTER (WHERE te.event_name = 'topup_order_not_paid')::int AS order_not_paid
       FROM telemetry_events te
       WHERE te.created_at >= NOW() - ($1::int * INTERVAL '1 hour')
         AND te.event_name IN (
           'topup_modal_opened',
           'topup_checkout_started',
           'topup_checkout_returned_success',
           'topup_checkout_returned_cancel',
           'topup_order_paid',
           'topup_order_not_paid'
         )
       GROUP BY COALESCE(NULLIF(te.props->>'ab_variant', ''), 'unknown')
       ORDER BY ab_variant ASC`,
      [rangeHours]
    );
    return result.rows;
  }
}
