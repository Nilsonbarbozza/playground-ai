# Telemetry Matrix v1

Este documento define os eventos rastreados para produto, billing, operações e análise de jornada.

## Campos padrão

- `event_name`
- `created_at` (UTC no banco)
- `user_id` (quando autenticado)
- `user_email` (obtido por join em dashboard admin)
- `session_id`
- `view_id`
- `route_or_feature`
- `source`
- `props` (jsonb para metadados)

## Eventos de jornada e uso

- `view_opened`
- `view_time_spent`
- `ui_click`
- `ui_error`
- `api_error`
- `provider_error`

## Eventos de billing/funil

- `topup_cta_clicked`
- `topup_modal_opened`
- `topup_modal_closed`
- `topup_checkout_started`
- `topup_checkout_returned_success`
- `topup_checkout_returned_cancel`
- `topup_order_paid`
- `topup_order_not_paid`

## Props recomendadas por evento

- `ui_click`: `element_label`, `element_tag`, `element_id`, `data_view`, `data_testid`, `modal_id`
- `topup_cta_clicked`: `trigger`
- `topup_modal_opened`: `trigger`
- `topup_checkout_started`: `package_id`
- `topup_checkout_returned_*`: `order_id`
- `topup_order_not_paid`: `order_id`, `status`
- `topup_*` (experimento): `ab_variant` (`A` ou `B`)

## Uso do dashboard admin

- `GET /api/telemetry/dashboard/summary`
- `GET /api/telemetry/dashboard/ops`
- `GET /api/telemetry/dashboard/interactions`
- `GET /api/telemetry/dashboard/credits`
- `GET /api/telemetry/dashboard/insights`
- `GET /api/telemetry/dashboard/experiments/topup`

Todos os endpoints acima são protegidos por `adminMiddleware`.
