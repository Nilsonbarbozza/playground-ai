function getApiBase() {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const outsidePort3000 = isLocal && window.location.port && window.location.port !== '3000';
  return outsidePort3000 ? 'http://localhost:3000/api' : '/api';
}

function number(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateTimeBRT(value) {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function card(key, value, valueClass = '') {
  const cls = valueClass ? `v ${valueClass}` : 'v';
  return `<div class="card"><div class="k">${key}</div><div class="${cls}">${value}</div></div>`;
}

function rowsHtml(items, columns) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<tr><td colspan="${columns.length}" class="muted">Sem dados no período.</td></tr>`;
  }
  return items
    .map((item) => `<tr>${columns.map((col) => `<td>${item[col] ?? '-'}</td>`).join('')}</tr>`)
    .join('');
}

function interactionsRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<tr><td colspan="4" class="muted">Sem interações no período.</td></tr>';
  }
  return items
    .map((item) => {
      const date = formatDateTimeBRT(item.created_at);
      const email = item.user_email || 'anonimo';
      const event = item.event_name || '-';
      const module = item.route_or_feature || item.view_id || '-';
      return `<tr><td>${date}</td><td>${email}</td><td>${event}</td><td>${module}</td></tr>`;
    })
    .join('');
}

function insightsRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<tr><td colspan="4" class="muted">Sem insights no período.</td></tr>';
  }
  return items
    .map((item) => {
      const severity = String(item.severity || 'info').toUpperCase();
      const title = item.title || '-';
      const detail = item.detail || '-';
      const action = item.action || '-';
      return `<tr><td>${severity}</td><td>${title}</td><td>${detail}</td><td>${action}</td></tr>`;
    })
    .join('');
}

function creditUsageRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<tr><td colspan="4" class="muted">Sem consumo de créditos no período.</td></tr>';
  }
  return items
    .map(
      (item) =>
        `<tr><td>${item.module || '-'}</td><td>${number(item.credits_spent)}</td><td>${number(item.credits_added)}</td><td>${number(item.events_count)}</td></tr>`
    )
    .join('');
}

function creditMovementsRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<tr><td colspan="6" class="muted">Sem movimentações de créditos no período.</td></tr>';
  }
  return items
    .map((item) => {
      const date = formatDateTimeBRT(item.created_at);
      const email = item.user_email || 'anonimo';
      const type = item.movement_type || '-';
      const module = item.module || '-';
      const qty = number(item.amount);
      const description = item.description || '-';
      return `<tr><td>${date}</td><td>${email}</td><td>${type}</td><td>${module}</td><td>${qty}</td><td>${description}</td></tr>`;
    })
    .join('');
}

function setNotice(message, isError = false) {
  const notice = document.getElementById('notice');
  notice.textContent = message;
  notice.className = isError ? 'notice status-critical' : 'notice muted';
}

function cleanInput(id, maxLen = 255) {
  const el = document.getElementById(id);
  if (!el) return '';
  return String(el.value || '').trim().slice(0, maxLen);
}

function readFilters() {
  const limit = Math.min(Math.max(number(document.getElementById('filter-limit')?.value), 1), 500);
  const dateFromRaw = cleanInput('filter-date-from', 40);
  const dateToRaw = cleanInput('filter-date-to', 40);
  const dateFrom = dateFromRaw ? new Date(dateFromRaw).toISOString() : '';
  const dateTo = dateToRaw ? new Date(dateToRaw).toISOString() : '';

  return {
    limit,
    email: cleanInput('filter-email', 255),
    event_name: cleanInput('filter-event', 120),
    route_or_feature: cleanInput('filter-route', 180),
    date_from: dateFrom,
    date_to: dateTo
  };
}

async function request(path) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Sem token. Faça login no app principal primeiro.');
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }
  return payload;
}

async function loadDashboard() {
  const rangeHoursInput = document.getElementById('range-hours');
  const rangeHours = Math.min(Math.max(number(rangeHoursInput.value), 1), 720);
  rangeHoursInput.value = String(rangeHours);
  const filters = readFilters();
  const interactionQuery = new URLSearchParams({
    range_hours: String(rangeHours),
    limit: String(filters.limit)
  });
  if (filters.email) interactionQuery.set('email', filters.email);
  if (filters.event_name) interactionQuery.set('event_name', filters.event_name);
  if (filters.route_or_feature) interactionQuery.set('route_or_feature', filters.route_or_feature);
  if (filters.date_from) interactionQuery.set('date_from', filters.date_from);
  if (filters.date_to) interactionQuery.set('date_to', filters.date_to);
  const creditsQuery = new URLSearchParams({
    range_hours: String(rangeHours),
    limit: String(filters.limit)
  });
  if (filters.email) creditsQuery.set('email', filters.email);
  if (filters.route_or_feature) creditsQuery.set('module', filters.route_or_feature);
  if (filters.date_from) creditsQuery.set('date_from', filters.date_from);
  if (filters.date_to) creditsQuery.set('date_to', filters.date_to);

  setNotice('Carregando dados...');

  try {
    const [opsRes, summaryRes, interactionsRes, insightsRes, creditsRes] = await Promise.all([
      request(`/telemetry/dashboard/ops?range_hours=${rangeHours}`),
      request(`/telemetry/dashboard/summary?range_hours=${rangeHours}`),
      request(`/telemetry/dashboard/interactions?${interactionQuery.toString()}`),
      request(`/telemetry/dashboard/insights?range_hours=${rangeHours}`),
      request(`/telemetry/dashboard/credits?${creditsQuery.toString()}`)
    ]);

    const ops = opsRes.ops || {};
    const summary = summaryRes.summary || {};

    const status = String(ops.status || 'unknown');
    const statusClass = `status-${status}`;

    document.getElementById('ops-grid').innerHTML = [
      card('Status', status.toUpperCase(), statusClass),
      card('Checkout Start %', `${number(ops.key_metrics?.checkout_start_rate_percent)}%`),
      card('Checkout Abandon %', `${number(ops.key_metrics?.checkout_abandon_rate_percent)}%`),
      card('Paid After Start %', `${number(ops.key_metrics?.paid_after_start_rate_percent)}%`),
      card('Erros Totais', number(ops.key_metrics?.errors_total))
    ].join('');

    const funnel = summary.funnel || {};
    document.getElementById('funnel-grid').innerHTML = [
      card('Modal Opened', number(funnel.topup_modal_opened)),
      card('Checkout Started', number(funnel.topup_checkout_started)),
      card('Return Success', number(funnel.topup_checkout_returned_success)),
      card('Return Cancel', number(funnel.topup_checkout_returned_cancel)),
      card('Order Paid', number(funnel.topup_order_paid)),
      card('Order Not Paid', number(funnel.topup_order_not_paid))
    ].join('');

    document.getElementById('top-views').innerHTML = rowsHtml(summary.top_views, ['view_id', 'total']);
    document.getElementById('top-features').innerHTML = rowsHtml(summary.top_features, ['feature', 'total']);
    document.getElementById('errors-by-module').innerHTML = rowsHtml(summary.errors_by_module, [
      'module',
      'event_name',
      'total'
    ]);
    document.getElementById('insights-list').innerHTML = insightsRows(insightsRes.insights);
    document.getElementById('recent-interactions').innerHTML = interactionsRows(interactionsRes.interactions);
    document.getElementById('credit-usage-modules').innerHTML = creditUsageRows(creditsRes.usage_by_module);
    document.getElementById('credit-movements').innerHTML = creditMovementsRows(creditsRes.movements);

    const generatedAt = summary.generated_at || ops.generated_at || new Date().toISOString();
    setNotice(
      `Atualizado em ${formatDateTimeBRT(generatedAt)} (BRT) | janela: ${rangeHours}h | insights: ${number(
        insightsRes.total_insights
      )} | interacoes: ${number(interactionsRes.total)} | mov. créditos: ${Array.isArray(creditsRes.movements) ? creditsRes.movements.length : 0}`
    );
  } catch (err) {
    const msg = String(err.message || 'Falha ao carregar telemetria.');
    if (msg.includes('403') || /administradores|restrito/i.test(msg)) {
      setNotice('Acesso restrito: apenas owner/admin pode visualizar a telemetria.', true);
      return;
    }
    if (msg.includes('401') || /token|login/i.test(msg)) {
      setNotice('Sessão inválida. Faça login no app principal e tente novamente.', true);
      return;
    }
    setNotice(msg, true);
  }
}

document.getElementById('btn-refresh').addEventListener('click', () => loadDashboard());
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  const fields = ['filter-email', 'filter-event', 'filter-route', 'filter-date-from', 'filter-date-to'];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const limit = document.getElementById('filter-limit');
  if (limit) limit.value = '200';
  loadDashboard();
});
document.getElementById('range-hours').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loadDashboard();
  }
});
['filter-email', 'filter-event', 'filter-route', 'filter-date-from', 'filter-date-to', 'filter-limit'].forEach((id) => {
  document.getElementById(id)?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadDashboard();
  });
});

loadDashboard();
