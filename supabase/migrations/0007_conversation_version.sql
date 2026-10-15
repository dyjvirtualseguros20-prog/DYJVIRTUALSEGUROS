-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 · Versión de la conversación (protección contra escrituras obsoletas)
-- ───────────────────────────────────────────────────────────────────────────
-- SOLO AGREGA: una columna con valor inicial 0, una función y un trigger.
-- No borra ni transforma datos. Rollback en supabase/backups/2026-10-09_antes_de_0007.sql
--
-- Cómo se usa:
--   - Cualquier cambio del ESTADO de la conversación (venga del Worker o de /admin) sube
--     la versión en 1 (trigger). last_message_at y updated_at no cuentan como cambio de estado.
--   - El Worker escribe con "where version = <la que leyó>": si alguien cambió la conversación
--     mientras se procesaba un mensaje (p. ej. un asesor la tomó), la escritura no se aplica
--     y el mensaje se reintenta con el estado actualizado.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.chat_conversations
  add column if not exists version integer not null default 0 check (version >= 0);

create or replace function public.chat_conversations_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status, new.intent, new.escalation_reason, new.lead_state, new.pending_action, new.quote_draft,
      new.quote_request_id, new.assigned_advisor_id, new.taken_by, new.taken_at, new.closed_at)
     is distinct from
     (old.status, old.intent, old.escalation_reason, old.lead_state, old.pending_action, old.quote_draft,
      old.quote_request_id, old.assigned_advisor_id, old.taken_by, old.taken_at, old.closed_at) then
    new.version := old.version + 1;
  else
    -- Nadie puede fijar la versión a mano: solo cambia cuando cambia el estado.
    new.version := old.version;
  end if;
  return new;
end;
$$;

-- Es una función de trigger: nadie debe poder llamarla directamente.
revoke all on function public.chat_conversations_bump_version() from public, anon, authenticated;

drop trigger if exists chat_conversations_bump_version on public.chat_conversations;
create trigger chat_conversations_bump_version
  before update on public.chat_conversations
  for each row execute function public.chat_conversations_bump_version();
