-- ═══════════════════════════════════════════════════════════════════════════
--  RESPALDO ANTES DE LA MIGRACIÓN 0009 (auditoría y capa de acciones) — 2026-10-11
--  Proyecto: dj-virtual-seguros (tsrnkezdfpxjafmcawgq)
--
--  Estado previo (verificado con consultas antes de aplicar):
--    - No existían: audit_events, tool_policies, action_proposals, tool_idempotency,
--      public.log_staff_action(), private.audit_events_append_only().
--    - 0009 NO modifica tablas, funciones, políticas ni datos existentes
--      (quote_requests, chat_*, advisors, staff_users, admin_users siguen igual).
--    - Permisos previos de wa_bot: select/insert/update en chat_contacts, chat_conversations,
--      chat_messages; select/insert en chat_consents; select (id, name, active) en advisors;
--      execute en submit_quote_request. 0009 le agrega solo: insert en audit_events y
--      action_proposals, select en tool_policies, select/insert/update en tool_idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ROLLBACK de 0009 (ejecutar completo en el SQL Editor) ──────────────────
-- ATENCIÓN: borrar audit_events elimina el historial de auditoría. Antes de deshacer,
-- exportar la tabla (Table Editor → audit_events → Export to CSV).
-- El trigger de solo inserción impide TRUNCATE y DELETE, pero no DROP TABLE.
begin;

drop function if exists public.log_staff_action(text, text, text, text, text, text, text, text, jsonb);
drop table if exists public.tool_idempotency;
drop table if exists public.action_proposals;
drop table if exists public.tool_policies;
drop table if exists public.audit_events;
drop function if exists private.audit_events_append_only();

commit;
