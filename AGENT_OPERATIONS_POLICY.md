# AGENT OPERATIONS POLICY

## 1. Objetivo

Definir como o agente administrador deve monitorar, diagnosticar e agir no projeto `teste-cloner` com consistencia operacional.

---

## 2. Principios

1. seguranca antes de velocidade
2. idempotencia em operacoes financeiras
3. degradacao parcial ao inves de indisponibilidade total
4. acoes baseadas em runbook e evidencias
5. deploy somente com gates aprovados

---

## 3. Niveis de Severidade

## Sev-1 (critico)

Exemplos:

- compra de creditos duplicando saldo
- falha generalizada de auth
- indisponibilidade total da API

Acao:

1. alertar imediatamente
2. mitigar (degradar feature de risco)
3. abrir incidente com timeline
4. executar rollback seguro se necessario

## Sev-2 (alto)

Exemplos:

- erro recorrente em checkout-session
- webhook com falhas persistentes
- crescimento anormal de pedidos `pending`

Acao:

1. alertar e investigar em ate 15 min
2. aplicar mitigacao parcial
3. validar recuperacao com smoke

## Sev-3 (medio)

Exemplos:

- erro funcional em modulo nao-critico
- regressao de UX sem perda financeira

Acao:

1. abrir task de correcao priorizada
2. monitorar recorrencia

---

## 4. SLO e Gatilhos

Metricas minimas:

1. `api_health_ok_rate`
2. `checkout_session_success_rate`
3. `webhook_processing_success_rate`
4. `auth_login_success_rate`
5. `error_rate_by_module`

Gatilhos recomendados:

1. `checkout 5xx > 2% por 5 min` -> alerta Sev-2
2. `webhook failure > 1% por 10 min` -> alerta Sev-2
3. `pending orders > limiar por 15 min` -> job de reconciliacao + alerta
4. `duplicidade detectada em ledger` -> alerta Sev-1

---

## 5. Gates de Deploy (obrigatorios)

Antes de promover:

1. `npm run check:staging` = OK
2. `npm run smoke:billing` = OK
3. checkout testado fim a fim
4. webhook processando evento com status `paid`
5. sem erro critico aberto

Regra:

- se qualquer gate falhar, bloqueia deploy.

---

## 6. Modo Degradado Seguro

Se Stripe estiver instavel:

1. ocultar/disable CTA de compra no frontend
2. manter webhook ativo
3. manter funcionalidades de geracao e projetos
4. exibir mensagem clara ao usuario

---

## 7. Formato de Resposta do Agente

Toda resposta operacional deve seguir:

1. `status` (ok, warning, critical)
2. `impacto`
3. `causa provavel`
4. `evidencias` (query/log/endpoint)
5. `acao recomendada`
6. `comandos executaveis`

---

## 8. Politica de Dados e Privacidade

1. nao registrar senha/token/cartao
2. mascarar dados sensiveis em logs
3. usar retention definida para telemetria
4. garantir trilha de auditoria para creditos

---

## 9. Comandos Operacionais Padrao

Saude e prontidao:

```bash
npm run check:staging
```

Smoke de billing:

```bash
npm run smoke:billing
```

Migracao:

```bash
node migrate-level3.js
```

---

## 10. Backlog Operacional Prioritario

1. adicionar `smoke:topup` completo (checkout + webhook + credito)
2. implementar `X-Idempotency-Key` no cliente para compra
3. criar reconciliador de pedidos `pending`
4. implementar telemetria de produto e funil
