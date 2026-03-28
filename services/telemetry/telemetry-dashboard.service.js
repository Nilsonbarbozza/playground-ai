import { TelemetryAnalyticsRepository } from '../../repositories/telemetry-analytics.repository.js';

function asInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value, max = 255) {
  if (typeof value !== 'string') return null;
  const out = value.trim();
  if (!out) return null;
  return out.slice(0, max);
}

function asIsoDateTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export class TelemetryDashboardService {
  static async getSummary(query = {}) {
    const rangeHoursRaw = asInt(query.range_hours, 24);
    const rangeHours = Math.min(Math.max(rangeHoursRaw, 1), 24 * 30);
    const topLimitRaw = asInt(query.top_limit, 10);
    const topLimit = Math.min(Math.max(topLimitRaw, 1), 50);

    const [funnelRows, topViews, topFeatures, errorsByModule] = await Promise.all([
      TelemetryAnalyticsRepository.getFunnel(rangeHours),
      TelemetryAnalyticsRepository.getTopViews(rangeHours, topLimit),
      TelemetryAnalyticsRepository.getTopFeatures(rangeHours, topLimit),
      TelemetryAnalyticsRepository.getErrorsByModule(rangeHours, topLimit)
    ]);

    const funnelMap = Object.fromEntries(funnelRows.map((row) => [row.event_name, row.total]));
    const modalOpened = funnelMap.topup_modal_opened || 0;
    const checkoutStarted = funnelMap.topup_checkout_started || 0;
    const checkoutReturnedSuccess = funnelMap.topup_checkout_returned_success || 0;
    const checkoutReturnedCancel = funnelMap.topup_checkout_returned_cancel || 0;
    const ordersPaid = funnelMap.topup_order_paid || 0;
    const ordersNotPaid = funnelMap.topup_order_not_paid || 0;

    const safeRate = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0);

    return {
      range_hours: rangeHours,
      generated_at: new Date().toISOString(),
      funnel: {
        topup_modal_opened: modalOpened,
        topup_modal_closed: funnelMap.topup_modal_closed || 0,
        topup_cta_clicked: funnelMap.topup_cta_clicked || 0,
        topup_checkout_started: checkoutStarted,
        topup_checkout_returned_success: checkoutReturnedSuccess,
        topup_checkout_returned_cancel: checkoutReturnedCancel,
        topup_order_paid: ordersPaid,
        topup_order_not_paid: ordersNotPaid
      },
      metrics: {
        checkout_start_rate_percent: safeRate(checkoutStarted, modalOpened),
        checkout_abandon_rate_percent: safeRate(checkoutReturnedCancel, checkoutStarted),
        paid_after_start_rate_percent: safeRate(ordersPaid, checkoutStarted),
        paid_after_return_success_rate_percent: safeRate(ordersPaid, checkoutReturnedSuccess)
      },
      top_views: topViews,
      top_features: topFeatures,
      errors_by_module: errorsByModule
    };
  }

  static async getRecentInteractions(query = {}) {
    const rangeHoursRaw = asInt(query.range_hours, 24);
    const rangeHours = Math.min(Math.max(rangeHoursRaw, 1), 24 * 30);
    const limitRaw = asInt(query.limit, 100);
    const limit = Math.min(Math.max(limitRaw, 1), 500);

    const email = asString(query.email, 255);
    const eventName = asString(query.event_name, 120);
    const routeOrFeature = asString(query.route_or_feature, 180);
    const dateFrom = asIsoDateTime(query.date_from);
    const dateTo = asIsoDateTime(query.date_to);

    const rows = await TelemetryAnalyticsRepository.getRecentInteractions({
      rangeHours,
      limit,
      email,
      eventName,
      routeOrFeature,
      dateFrom,
      dateTo
    });
    return {
      range_hours: rangeHours,
      generated_at: new Date().toISOString(),
      total: rows.length,
      filters: {
        email,
        event_name: eventName,
        route_or_feature: routeOrFeature,
        date_from: dateFrom,
        date_to: dateTo,
        limit
      },
      interactions: rows
    };
  }

  static async getOpsStatus(query = {}) {
    const summary = await this.getSummary(query);

    const checkoutStartRate = summary.metrics.checkout_start_rate_percent;
    const checkoutAbandonRate = summary.metrics.checkout_abandon_rate_percent;
    const paidAfterStartRate = summary.metrics.paid_after_start_rate_percent;

    const thresholdWarnAbandon = Number.parseFloat(query.warn_abandon_rate_percent ?? '30');
    const thresholdCriticalAbandon = Number.parseFloat(query.critical_abandon_rate_percent ?? '50');
    const thresholdWarnPaid = Number.parseFloat(query.warn_paid_after_start_rate_percent ?? '30');
    const thresholdCriticalPaid = Number.parseFloat(query.critical_paid_after_start_rate_percent ?? '15');
    const thresholdWarnErrors = Number.parseInt(query.warn_errors_total ?? '10', 10);
    const thresholdCriticalErrors = Number.parseInt(query.critical_errors_total ?? '30', 10);

    const totalErrors = summary.errors_by_module.reduce((acc, item) => acc + Number(item.total || 0), 0);

    const signals = [];

    if (checkoutAbandonRate >= thresholdCriticalAbandon) {
      signals.push({
        level: 'critical',
        code: 'checkout_abandon_high',
        message: `Taxa de abandono no checkout muito alta (${checkoutAbandonRate}%).`
      });
    } else if (checkoutAbandonRate >= thresholdWarnAbandon) {
      signals.push({
        level: 'warn',
        code: 'checkout_abandon_warn',
        message: `Taxa de abandono no checkout elevada (${checkoutAbandonRate}%).`
      });
    }

    if (paidAfterStartRate <= thresholdCriticalPaid && summary.funnel.topup_checkout_started > 0) {
      signals.push({
        level: 'critical',
        code: 'paid_after_start_low',
        message: `Conversao de pagamento apos inicio muito baixa (${paidAfterStartRate}%).`
      });
    } else if (paidAfterStartRate <= thresholdWarnPaid && summary.funnel.topup_checkout_started > 0) {
      signals.push({
        level: 'warn',
        code: 'paid_after_start_warn',
        message: `Conversao de pagamento apos inicio baixa (${paidAfterStartRate}%).`
      });
    }

    if (totalErrors >= thresholdCriticalErrors) {
      signals.push({
        level: 'critical',
        code: 'errors_total_high',
        message: `Volume de erros alto no periodo (${totalErrors}).`
      });
    } else if (totalErrors >= thresholdWarnErrors) {
      signals.push({
        level: 'warn',
        code: 'errors_total_warn',
        message: `Volume de erros elevado no periodo (${totalErrors}).`
      });
    }

    const status = signals.some((s) => s.level === 'critical')
      ? 'critical'
      : signals.some((s) => s.level === 'warn')
      ? 'warn'
      : 'ok';

    const actions = [];
    if (status === 'critical') {
      actions.push('investigate_now');
      actions.push('consider_degraded_mode_for_billing');
    } else if (status === 'warn') {
      actions.push('monitor_closely');
      actions.push('open_triage_ticket');
    } else {
      actions.push('keep_monitoring');
    }

    return {
      status,
      generated_at: summary.generated_at,
      range_hours: summary.range_hours,
      key_metrics: {
        checkout_start_rate_percent: checkoutStartRate,
        checkout_abandon_rate_percent: checkoutAbandonRate,
        paid_after_start_rate_percent: paidAfterStartRate,
        errors_total: totalErrors
      },
      signals,
      actions,
      summary
    };
  }

  static async getCreditsDashboard(query = {}) {
    const rangeHoursRaw = asInt(query.range_hours, 24);
    const rangeHours = Math.min(Math.max(rangeHoursRaw, 1), 24 * 30);
    const limitRaw = asInt(query.limit, 200);
    const limit = Math.min(Math.max(limitRaw, 1), 500);
    const email = asString(query.email, 255);
    const module = asString(query.module, 64);
    const dateFrom = asIsoDateTime(query.date_from);
    const dateTo = asIsoDateTime(query.date_to);

    const [usageByModule, movements, topSpenders] = await Promise.all([
      TelemetryAnalyticsRepository.getCreditUsageByModule(rangeHours, 20),
      TelemetryAnalyticsRepository.getCreditMovements({
        rangeHours,
        limit,
        email,
        module,
        dateFrom,
        dateTo
      }),
      TelemetryAnalyticsRepository.getTopCreditSpenders(rangeHours, 20)
    ]);

    const totals = usageByModule.reduce(
      (acc, item) => {
        acc.credits_spent += Number(item.credits_spent || 0);
        acc.credits_added += Number(item.credits_added || 0);
        return acc;
      },
      { credits_spent: 0, credits_added: 0 }
    );

    return {
      range_hours: rangeHours,
      generated_at: new Date().toISOString(),
      filters: {
        email,
        module,
        date_from: dateFrom,
        date_to: dateTo,
        limit
      },
      totals,
      usage_by_module: usageByModule,
      top_spenders: topSpenders,
      movements
    };
  }

  static async getInsights(query = {}) {
    const [ops, interactions, credits] = await Promise.all([
      this.getOpsStatus(query),
      this.getRecentInteractions(query),
      this.getCreditsDashboard(query)
    ]);

    const insights = [];
    const pushInsight = (kind, severity, code, title, detail, action) => {
      insights.push({ kind, severity, code, title, detail, action });
    };

    if (Number(ops.key_metrics?.checkout_abandon_rate_percent || 0) >= 30) {
      pushInsight(
        'risk',
        Number(ops.key_metrics.checkout_abandon_rate_percent) >= 50 ? 'critical' : 'warn',
        'checkout_abandonment_high',
        'Abandono de checkout elevado',
        `Taxa atual: ${ops.key_metrics.checkout_abandon_rate_percent}%`,
        'Revisar UX do modal e copy do CTA pagar.'
      );
    }

    if (Number(ops.key_metrics?.paid_after_start_rate_percent || 0) <= 30 && Number(ops.summary?.funnel?.topup_checkout_started || 0) > 0) {
      pushInsight(
        'risk',
        Number(ops.key_metrics.paid_after_start_rate_percent) <= 15 ? 'critical' : 'warn',
        'conversion_low_after_checkout_start',
        'Conversão baixa após início do checkout',
        `Conversão: ${ops.key_metrics.paid_after_start_rate_percent}%`,
        'Validar redirecionamento, tempo de resposta e mensagens de erro no checkout.'
      );
    }

    const topModule = (credits.usage_by_module || [])[0];
    if (topModule && Number(topModule.credits_spent || 0) > 0) {
      pushInsight(
        'opportunity',
        'info',
        'top_credit_consumption_module',
        'Módulo com maior consumo de créditos',
        `${topModule.module} consumiu ${topModule.credits_spent} créditos no período.`,
        'Priorizar melhorias e upsell nesse módulo.'
      );
    }

    const anonInteractions = (interactions.interactions || []).filter((i) => !i.user_email).length;
    const totalInteractions = Number(interactions.total || 0);
    const anonRate = totalInteractions > 0 ? Number(((anonInteractions / totalInteractions) * 100).toFixed(2)) : 0;
    if (anonRate >= 20) {
      pushInsight(
        'risk',
        anonRate >= 40 ? 'warn' : 'info',
        'anonymous_interactions_high',
        'Alta proporção de interações anônimas',
        `${anonRate}% das interações sem email resolvido no período.`,
        'Incentivar login antes de ações-chave e validar persistência de sessão.'
      );
    }

    const topSpender = (credits.top_spenders || [])[0];
    if (topSpender && Number(topSpender.credits_spent || 0) > 0) {
      pushInsight(
        'opportunity',
        'info',
        'power_user_identified',
        'Usuário com maior gasto de créditos',
        `${topSpender.user_email || topSpender.user_id}: ${topSpender.credits_spent} créditos.`,
        'Criar campanha VIP/feedback para usuários de alto uso.'
      );
    }

    return {
      generated_at: new Date().toISOString(),
      range_hours: Number(query.range_hours || 24),
      total_insights: insights.length,
      insights
    };
  }

  static async getTopupExperiment(query = {}) {
    const rangeHoursRaw = asInt(query.range_hours, 24);
    const rangeHours = Math.min(Math.max(rangeHoursRaw, 1), 24 * 30);
    const rows = await TelemetryAnalyticsRepository.getTopupExperimentByVariant(rangeHours);
    const includeUnknown = String(query.include_unknown || 'false').toLowerCase() === 'true';

    const safeRate = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0);
    const mapped = rows.map((row) => {
      const modalOpened = Number(row.modal_opened || 0);
      const checkoutStarted = Number(row.checkout_started || 0);
      const orderPaid = Number(row.order_paid || 0);
      return {
        ab_variant: row.ab_variant,
        modal_opened: modalOpened,
        checkout_started: checkoutStarted,
        checkout_success_return: Number(row.checkout_success_return || 0),
        checkout_cancel_return: Number(row.checkout_cancel_return || 0),
        order_paid: orderPaid,
        order_not_paid: Number(row.order_not_paid || 0),
        checkout_start_rate_percent: safeRate(checkoutStarted, modalOpened),
        paid_after_start_rate_percent: safeRate(orderPaid, checkoutStarted)
      };
    });
    const variants = includeUnknown ? mapped : mapped.filter((v) => v.ab_variant === 'A' || v.ab_variant === 'B');

    const ranked = [...variants]
      .filter((v) => v.ab_variant === 'A' || v.ab_variant === 'B')
      .sort((a, b) => b.paid_after_start_rate_percent - a.paid_after_start_rate_percent);

    return {
      range_hours: rangeHours,
      generated_at: new Date().toISOString(),
      variants,
      winner: ranked[0] || null
    };
  }
}
