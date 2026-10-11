-- ═══════════════════════════════════════════════════════════════════════════
--  RESPALDO ANTES DE LA MIGRACIÓN 0010 (MVP: contexto del cliente) — 2026-10-11
--  Proyecto: dj-virtual-seguros (tsrnkezdfpxjafmcawgq)
--
--  Estado previo (verificado antes de aplicar):
--    - advisors: cristian (activo), jeisson (activo); sin columna central_base.
--    - No existían chat_contact_requests ni public.wa_contact_requests().
--    - quote_requests: 0 filas. chat_*: 0 filas. audit_events: 0 filas.
--    - tool_policies: 6 filas (0009).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ROLLBACK de 0010 ────────────────────────────────────────────────────────
begin;

delete from public.tool_policies where action in ('contexto.consultar_solicitudes', 'solicitud.pedir_revision');
drop function if exists public.wa_contact_requests(uuid);
drop table if exists public.chat_contact_requests;
revoke select (central_base) on public.advisors from wa_bot;
alter table public.advisors drop column if exists central_base;

commit;
