-- ═══════════════════════════════════════════════════════════════════════════
--  RESPALDO ANTES DE LA MIGRACIÓN 0008 (cuentas y roles del panel) — 2026-10-11
--  Proyecto: dj-virtual-seguros (tsrnkezdfpxjafmcawgq)
--
--  Estado previo (verificado con consultas antes de aplicar):
--    - auth.users: 1 usuario (el administrador). public.admin_users: 1 fila
--      (user_id 34bbfecd-b98a-4480-8b2e-f6d2ca147df9). 0008 NO modifica admin_users.
--    - quote_requests: 0 filas. chat_*: 0 filas. advisors: cristian, jeisson (activos).
--    - Funciones: private.is_admin(), public.set_updated_at(),
--      public.submit_quote_request(...), public.chat_conversations_bump_version().
--    - No existían: public.staff_users, private.current_advisor_id(),
--      private.staff_users_guard(), ni políticas *_asesor_*.
--
--  Definición previa de private.is_admin() (0001):
--
--    create or replace function private.is_admin()
--    returns boolean language sql stable security definer set search_path = ''
--    as $$ select exists (select 1 from public.admin_users where user_id = (select auth.uid())); $$;
--
--  Políticas previas (sin cambios en 0008; 0008 solo AGREGA políticas):
--    admin_users_select_own, quote_requests_admin_select, quote_requests_admin_update,
--    advisors_public_read_active, advisors_admin_read_all, insurer_transmissions_admin_select,
--    chat_contacts_admin_select, chat_conversations_admin_select, chat_conversations_admin_update,
--    chat_messages_admin_select, chat_consents_admin_select, chat_*_wa_bot, advisors_wa_bot_read.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ROLLBACK de 0008 (ejecutar completo en el SQL Editor) ──────────────────
-- Devuelve el panel exactamente al estado anterior: is_admin() vuelve a leer
-- admin_users (que 0008 no tocó) y se quitan las políticas de asesor.
begin;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

drop policy if exists quote_requests_asesor_select on public.quote_requests;
drop policy if exists quote_requests_asesor_update on public.quote_requests;
drop policy if exists chat_conversations_asesor_select on public.chat_conversations;
drop policy if exists chat_conversations_asesor_update on public.chat_conversations;
drop policy if exists chat_messages_asesor_select on public.chat_messages;
drop policy if exists chat_consents_asesor_select on public.chat_consents;
drop policy if exists chat_contacts_asesor_select on public.chat_contacts;

drop function if exists private.current_advisor_id();

-- staff_users guarda las cuentas creadas después de 0008. Si ya hay cuentas de
-- asesor reales, exportarlas antes de borrar la tabla.
drop table if exists public.staff_users;
drop function if exists private.staff_users_guard();

commit;
