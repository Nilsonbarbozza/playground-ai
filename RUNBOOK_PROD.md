# RUNBOOK PROD - STRIPE TOPUP (CREDITOS)

## 1. Objetivo

Guia operacional para ativar e validar compra de creditos em producao com Stripe.

Escopo:

- Checkout Session
- Webhook de confirmacao
- Credito de saldo
- Auditoria de pedido e ledger

---

## 2. Pre-requisitos

1. Backend publicado com HTTPS.
2. Banco de producao acessivel.
3. Stripe conta ativa em modo live.
4. Migracoes aplicadas (`migrate-level3.js`).

---

## 3. Variaveis de Ambiente (PROD)

Definir no servidor de producao:

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_BASE_URL=https://seu-dominio
```

Observacoes:

- Nao usar `sk_test` em producao.
- Nao usar `whsec` de `stripe listen` local.

---

## 4. Stripe Dashboard (LIVE)

## 4.1 Produtos e precos

Criar produto/plano no Stripe (modo live), por exemplo:

- `Starter 500 Creditos`
- `R$ 50,00`

Copiar `price_id` live (ex.: `price_...`).

## 4.2 Webhook endpoint

Criar endpoint:

- URL: `https://seu-dominio/api/billing/webhook`
- Eventos:
  - `checkout.session.completed`
  - `checkout.session.expired`

Copiar signing secret (`whsec_...`) e atualizar `STRIPE_WEBHOOK_SECRET`.

---

## 5. Banco de Dados (Pacotes)

Garantir pacote ativo em `credit_packages`:

```sql
INSERT INTO credit_packages (code, name, price_brl_cents, credits, active, stripe_price_id)
VALUES ('starter-500', 'Starter 500 Creditos', 5000, 500, true, 'price_live_xxx')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    price_brl_cents = EXCLUDED.price_brl_cents,
    credits = EXCLUDED.credits,
    active = EXCLUDED.active,
    stripe_price_id = EXCLUDED.stripe_price_id;
```

---

## 6. Deploy

1. Publicar codigo atualizado.
2. Aplicar migracao:

```bash
node migrate-level3.js
```

3. Reiniciar aplicacao.

---

## 7. Smoke de Producao (Manual)

Fluxo:

1. Login com usuario real de teste.
2. Abrir modal de creditos.
3. Selecionar plano.
4. Finalizar checkout.
5. Retornar para app.

Validacoes esperadas:

- Pedido em `credit_orders` com `status = paid`.
- Saldo do usuario incrementado.
- `credit_ledger` com entrada `TOPUP_ORDER:<order_id>`.

---

## 8. SQL de Auditoria Rapida

## 8.1 Ver ultimos pedidos

```sql
SELECT id, user_id, status, credits, amount_brl_cents, stripe_checkout_session_id, paid_at, created_at
FROM credit_orders
ORDER BY created_at DESC
LIMIT 20;
```

## 8.2 Ver ultimos creditos aplicados

```sql
SELECT user_id, amount, description, created_at
FROM credit_ledger
WHERE description LIKE 'TOPUP_ORDER:%'
ORDER BY created_at DESC
LIMIT 20;
```

## 8.3 Ver eventos de webhook processados

```sql
SELECT provider, event_id, event_type, processed_at
FROM webhook_events
ORDER BY processed_at DESC
LIMIT 20;
```

---

## 9. Resposta a Incidente

## 9.1 Sintoma: checkout cria sessao, mas saldo nao sobe

Checar:

1. Webhook endpoint live correto no Stripe.
2. `STRIPE_WEBHOOK_SECRET` correto no servidor.
3. Logs de erro em `/api/billing/webhook`.
4. Eventos em `webhook_events`.

## 9.2 Sintoma: duplicacao de credito

Checar:

1. `webhook_events` para repeticao do mesmo `event_id`.
2. `credit_orders` para status repetido indevido.

Acao:

- bloquear temporariamente compra no frontend.
- manter webhook ativo para concluir pedidos em curso.

---

## 10. Rollback Seguro

Se precisar desativar compras sem derrubar app:

1. Frontend:
- esconder botao/modal de compra.

2. Banco:
- desativar pacotes:

```sql
UPDATE credit_packages SET active = false;
```

3. Backend:
- manter rota de webhook ativa para reconciliar pedidos ja iniciados.

---

## 11. Checklist Final de Go-Live

1. `sk_live` configurada.
2. `whsec` live configurado.
3. `APP_BASE_URL` real.
4. `price_id` live nos pacotes.
5. Migracao executada.
6. Compra real validada.
7. Auditoria SQL validada.
8. Plano de rollback pronto.
