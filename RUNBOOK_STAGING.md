# RUNBOOK STAGING - STRIPE TOPUP (PRE-PROD)

## 1. Objetivo

Validar fim a fim o fluxo de compra de creditos em ambiente de staging (modo teste Stripe), antes de promover para producao.

---

## 2. Configuracao de Ambiente (STAGING)

Definir no `.env` de staging:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_BASE_URL=https://staging.seu-dominio
```

Se rodar localmente:

```env
APP_BASE_URL=http://localhost:3000
```

---

## 3. Stripe Test Mode

1. Ativar `Test mode` no dashboard Stripe.
2. Criar produto/preco de teste (ou usar `price_data` dinamico).
3. Se usar `stripe_price_id`, salvar o ID de teste em `credit_packages`.

Webhook em staging publico:

- URL: `https://staging.seu-dominio/api/billing/webhook`

Webhook local:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

---

## 4. Banco (staging)

Executar migracao:

```bash
node migrate-level3.js
```

Garantir pacote ativo:

```sql
SELECT code, name, price_brl_cents, credits, active, stripe_price_id
FROM credit_packages
ORDER BY created_at DESC;
```

---

## 5. Fluxo de Teste Obrigatorio

## 5.1 Compra com sucesso

1. Logar/cadastrar usuario de teste.
2. Abrir modal de creditos.
3. Selecionar plano.
4. Ir para checkout Stripe.
5. Pagar com cartao de teste.
6. Retornar para app.

Esperado:

- `credit_orders.status = paid`
- `users.credits` incrementado
- `credit_ledger` com `TOPUP_ORDER:<order_id>`

## 5.2 Evento duplicado de webhook

No Stripe Dashboard, reenviar o mesmo evento.

Esperado:

- sem duplicar creditos
- sem criar segundo ledger do mesmo pedido

## 5.3 Checkout expirado/cancelado

Esperado:

- pedido em `expired` (quando aplicavel)
- saldo inalterado

---

## 6. SQL de Verificacao Rapida

## 6.1 Pedidos recentes

```sql
SELECT id, user_id, status, credits, amount_brl_cents, paid_at, created_at
FROM credit_orders
ORDER BY created_at DESC
LIMIT 30;
```

## 6.2 Ledger de top-up

```sql
SELECT user_id, amount, description, created_at
FROM credit_ledger
WHERE description LIKE 'TOPUP_ORDER:%'
ORDER BY created_at DESC
LIMIT 30;
```

## 6.3 Eventos webhook

```sql
SELECT event_id, event_type, processed_at
FROM webhook_events
ORDER BY processed_at DESC
LIMIT 30;
```

---

## 7. Criterio de Aprovacao para PROD

Somente promover se:

1. Fluxo sucesso aprovado.
2. Reenvio de webhook nao duplica credito.
3. Fluxo expirado/cancelado nao altera saldo.
4. Sem erros 5xx recorrentes em `/api/billing/checkout-session` e `/api/billing/webhook`.

---

## 8. Checklist de Handoff

1. Registrar versao testada (commit/tag).
2. Registrar `price_id` de staging e plano testado.
3. Registrar evidencias (order_id, event_id, logs).
4. Liberar promocao para runbook de producao.
