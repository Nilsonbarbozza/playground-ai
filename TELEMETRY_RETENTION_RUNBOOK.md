# Telemetry Retention Runbook

Este runbook define como manter telemetria para análise de curto e longo prazo com custo controlado.

## 1) Objetivo

- Manter eventos brutos para análise operacional recente.
- Gerar agregados diários para histórico de longo prazo.
- Aplicar retenção automática para evitar crescimento indefinido.

## 2) Script de manutenção

- Script: `scripts/telemetry-maintenance.js`
- Comandos:
  - `npm run telemetry:maintain:dry`
  - `npm run telemetry:maintain`

O script faz:
- upsert em `telemetry_events_daily`
- upsert em `credit_ledger_daily`
- purge por retenção configurada

## 3) Variáveis de ambiente

- `TELEMETRY_AGG_BACKFILL_DAYS` (default: `45`)
- `TELEMETRY_RETENTION_DAYS` (default: `180`)
- `TELEMETRY_DAILY_RETENTION_DAYS` (default: `730`)
- `CREDIT_DAILY_RETENTION_DAYS` (default: `1460`)
- `CREDIT_LEDGER_RETENTION_DAYS` (default: `0`, desabilitado)

## 4) Política recomendada

- Eventos brutos (`telemetry_events`): 180 dias
- Agregados de telemetria (`telemetry_events_daily`): 24 meses
- Agregados de crédito (`credit_ledger_daily`): 48 meses
- Ledger bruto (`credit_ledger`): manter completo (`0`) por auditoria

## 5) Agendamento

Execute diariamente (ex.: 02:10 AM):
- Windows Task Scheduler: `npm run telemetry:maintain`
- Linux cron: `10 2 * * * cd /path/project && npm run telemetry:maintain >> telemetry-maint.log 2>&1`

## 6) Verificação rápida

Após rodar:
- Validar saída JSON (`ok: true`)
- Conferir crescimento de `telemetry_events_daily` e `credit_ledger_daily`
- Conferir contagens pós-retention conforme política
