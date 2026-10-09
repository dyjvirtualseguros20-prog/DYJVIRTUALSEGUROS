-- Estado de public.chat_conversations ANTES de la migración 0007 (2026-10-09).
-- Filas en ese momento: chat_conversations 0 · chat_messages 0 · chat_contacts 0 · quote_requests 0
-- (no había datos que respaldar; se guarda la estructura y la forma de deshacer el cambio).
--
-- Columnas: id, contact_id, channel, status, intent, escalation_reason, lead_state, pending_action,
--           quote_draft, quote_request_id, assigned_advisor_id, taken_by, taken_at, last_message_at,
--           closed_at, created_at, updated_at
-- Triggers: chat_conversations_set_updated_at
-- Políticas RLS: chat_conversations_admin_select, chat_conversations_admin_update, chat_conversations_wa_bot
--
-- ROLLBACK de 0007 (deja la tabla exactamente como estaba antes):
drop trigger if exists chat_conversations_bump_version on public.chat_conversations;
drop function if exists public.chat_conversations_bump_version();
alter table public.chat_conversations drop column if exists version;
