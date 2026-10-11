-- ═══════════════════════════════════════════════════════════════════════════
--  AUDITORÍA Y CAPA SEGURA DE ACCIONES (paso 2.5)
--
--  - audit_events: registro de SOLO INSERCIÓN de cada acción (quién, qué, sobre qué,
--    cuándo, resultado). Un trigger impide UPDATE, DELETE y TRUNCATE a cualquier rol.
--    Sin contenido sensible: no hay columnas para mensajes ni datos personales y los
--    metadatos tienen tamaño limitado.
--      · wa_bot solo puede INSERTAR eventos de la IA, el canal o el sistema.
--      · El panel registra con public.log_staff_action(): el actor (admin/asesor) lo pone
--        la base de datos a partir de la sesión; nadie puede firmar como otro.
--      · Solo el administrador principal lee la auditoría.
--  - tool_policies: interruptor por acción (desactivar o exigir aprobación humana) sin
--    tocar el código. Solo puede hacer la política más estricta.
--  - action_proposals: acciones que la IA PROPONE y una persona decide.
--  - tool_idempotency: reserva de claves para que una acción no se ejecute dos veces.
--
--  Migración segura: solo agrega objetos y 6 filas de configuración (tool_policies).
--  No modifica tablas ni datos existentes. Rollback: supabase/backups/2026-10-11_antes_de_0009.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Auditoría ──────────────────────────────────────────────────────────────
create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  occurred_at     timestamptz not null default now(),
  actor_type      text not null check (actor_type in ('ia', 'admin', 'asesor', 'sistema', 'canal')),
  actor_id        text not null check (char_length(actor_id) between 1 and 120),
  -- Usuario de staff (solo admin/asesor). Sin FK: el evento sobrevive aunque cambie la cuenta.
  actor_user_id   uuid,
  channel         text not null check (channel in ('web', 'whatsapp', 'admin', 'sistema')),
  action          text not null check (action ~ '^[a-z_]{2,40}\.[a-z_]{2,40}$'),
  level           text not null check (level in ('leer', 'proponer', 'ejecutar', 'escalar')),
  resource_type   text check (char_length(resource_type) <= 40),
  resource_id     text check (char_length(resource_id) <= 120),
  outcome         text not null check (outcome in ('exito', 'denegado', 'error', 'duplicado', 'propuesto')),
  reason          text check (char_length(reason) <= 60),
  error_message   text check (char_length(error_message) <= 300),
  idempotency_key text check (char_length(idempotency_key) <= 200),
  metadata        jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4000),
  constraint audit_events_staff_actor check ((actor_type in ('admin', 'asesor')) = (actor_user_id is not null))
);

create index if not exists audit_events_occurred_at_idx on public.audit_events (occurred_at desc);
create index if not exists audit_events_resource_idx on public.audit_events (resource_type, resource_id);
create index if not exists audit_events_actor_user_idx on public.audit_events (actor_user_id) where actor_user_id is not null;

-- Solo inserción: ningún rol puede modificar ni borrar eventos.
create or replace function private.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events es de solo inserción: no se puede modificar ni borrar.'
    using errcode = '42501';
end;
$$;

revoke all on function private.audit_events_append_only() from public, anon, authenticated;

drop trigger if exists audit_events_no_update_delete on public.audit_events;
create trigger audit_events_no_update_delete
  before update or delete on public.audit_events
  for each row execute function private.audit_events_append_only();

drop trigger if exists audit_events_no_truncate on public.audit_events;
create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function private.audit_events_append_only();

alter table public.audit_events enable row level security;

revoke all on public.audit_events from anon, authenticated, service_role;
grant select on public.audit_events to authenticated;
grant select, insert on public.audit_events to service_role;

drop policy if exists audit_events_admin_select on public.audit_events;
create policy audit_events_admin_select on public.audit_events
  for select to authenticated
  using ((select private.is_admin()));

-- ─── Registro de acciones del panel ─────────────────────────────────────────
-- El actor lo pone la base de datos: rol y usuario de la sesión (cuenta de staff ACTIVA).
create or replace function public.log_staff_action(
  p_action text,
  p_level text,
  p_resource_type text,
  p_resource_id text,
  p_outcome text,
  p_reason text default null,
  p_error_message text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_id uuid;
begin
  select s.role into v_role
  from public.staff_users s
  where s.user_id = (select auth.uid()) and s.active;
  if v_role is null then
    raise exception 'Sin cuenta de staff activa.' using errcode = '42501';
  end if;

  insert into public.audit_events
    (actor_type, actor_id, actor_user_id, channel, action, level, resource_type, resource_id,
     outcome, reason, error_message, idempotency_key, metadata)
  values
    (case v_role when 'admin_principal' then 'admin' else 'asesor' end,
     (select auth.uid())::text, (select auth.uid()), 'admin', p_action, p_level, p_resource_type, p_resource_id,
     p_outcome, p_reason, p_error_message, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.log_staff_action(text, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.log_staff_action(text, text, text, text, text, text, text, text, jsonb) to authenticated;

-- ─── Políticas por acción (interruptor) ─────────────────────────────────────
create table if not exists public.tool_policies (
  action         text primary key check (action ~ '^[a-z_]{2,40}\.[a-z_]{2,40}$'),
  enabled        boolean not null default true,
  -- true = la IA y el sistema solo pueden PROPONER esta acción.
  requires_human boolean not null default false,
  note           text check (char_length(note) <= 300),
  updated_at     timestamptz not null default now()
);

drop trigger if exists tool_policies_set_updated_at on public.tool_policies;
create trigger tool_policies_set_updated_at
  before update on public.tool_policies
  for each row execute function public.set_updated_at();

alter table public.tool_policies enable row level security;

revoke all on public.tool_policies from anon, authenticated;
grant select on public.tool_policies to authenticated;
grant all on public.tool_policies to service_role;

drop policy if exists tool_policies_staff_select on public.tool_policies;
create policy tool_policies_staff_select on public.tool_policies
  for select to authenticated
  using ((select private.is_admin()) or (select private.current_advisor_id()) is not null);

insert into public.tool_policies (action, note) values
  ('solicitud.registrar', 'IA: registra la solicitud tras ACEPTO (autorizaciones A y B).'),
  ('conversacion.actualizar_turno', 'IA: guarda intención, datos y borrador de su conversación.'),
  ('conversacion.escalar', 'IA: pasa la conversación a una persona.'),
  ('solicitud.actualizar_gestion', 'Panel: estado, notas, valor y fecha de contacto.'),
  ('conversacion.gestionar', 'Panel: estado, asignación y tomar la conversación.'),
  ('conversacion.asignar_asesor', 'IA solo propone; decide una persona.')
on conflict (action) do nothing;

-- ─── Propuestas de la IA ────────────────────────────────────────────────────
create table if not exists public.action_proposals (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  action           text not null check (action ~ '^[a-z_]{2,40}\.[a-z_]{2,40}$'),
  proposed_by_type text not null check (proposed_by_type in ('ia', 'sistema', 'canal')),
  proposed_by_id   text not null check (char_length(proposed_by_id) between 1 and 120),
  channel          text not null check (channel in ('web', 'whatsapp', 'admin', 'sistema')),
  resource_type    text check (char_length(resource_type) <= 40),
  resource_id      text check (char_length(resource_id) <= 120),
  payload          jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4000),
  status           text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  decided_by       uuid references public.staff_users (user_id) on delete restrict,
  decided_at       timestamptz,
  idempotency_key  text unique check (char_length(idempotency_key) <= 200),
  constraint action_proposals_decision check ((status = 'pendiente') = (decided_by is null))
);

create index if not exists action_proposals_pending_idx on public.action_proposals (created_at desc) where status = 'pendiente';

alter table public.action_proposals enable row level security;

revoke all on public.action_proposals from anon, authenticated;
grant select on public.action_proposals to authenticated;
grant update (status, decided_by, decided_at) on public.action_proposals to authenticated;
grant all on public.action_proposals to service_role;

-- Solo el administrador principal ve y decide propuestas (firmando con su usuario).
drop policy if exists action_proposals_admin_select on public.action_proposals;
create policy action_proposals_admin_select on public.action_proposals
  for select to authenticated
  using ((select private.is_admin()));

drop policy if exists action_proposals_admin_decide on public.action_proposals;
create policy action_proposals_admin_decide on public.action_proposals
  for update to authenticated
  using ((select private.is_admin()) and status = 'pendiente')
  with check ((select private.is_admin()) and decided_by = (select auth.uid()));

-- ─── Idempotencia ───────────────────────────────────────────────────────────
create table if not exists public.tool_idempotency (
  key        text primary key check (char_length(key) between 1 and 200),
  action     text not null check (action ~ '^[a-z_]{2,40}\.[a-z_]{2,40}$'),
  status     text not null check (status in ('en_curso', 'completado', 'fallido')),
  -- Resultado mínimo para responder a un duplicado (p. ej. referencia de la solicitud).
  result     jsonb check (result is null or pg_column_size(result) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tool_idempotency_set_updated_at on public.tool_idempotency;
create trigger tool_idempotency_set_updated_at
  before update on public.tool_idempotency
  for each row execute function public.set_updated_at();

alter table public.tool_idempotency enable row level security;

revoke all on public.tool_idempotency from anon, authenticated;
grant all on public.tool_idempotency to service_role;

-- ─── Worker de WhatsApp (wa_bot): mínimo privilegio ─────────────────────────
-- Inserta auditoría solo como IA/canal/sistema (nunca como admin o asesor) y no la lee.
grant insert on public.audit_events to wa_bot;
drop policy if exists audit_events_wa_bot_insert on public.audit_events;
create policy audit_events_wa_bot_insert on public.audit_events
  for insert to wa_bot
  with check (actor_type in ('ia', 'canal', 'sistema') and actor_user_id is null and channel = 'whatsapp');

grant select on public.tool_policies to wa_bot;
drop policy if exists tool_policies_wa_bot_select on public.tool_policies;
create policy tool_policies_wa_bot_select on public.tool_policies for select to wa_bot using (true);

grant insert on public.action_proposals to wa_bot;
drop policy if exists action_proposals_wa_bot_insert on public.action_proposals;
create policy action_proposals_wa_bot_insert on public.action_proposals
  for insert to wa_bot
  with check (proposed_by_type in ('ia', 'canal', 'sistema') and status = 'pendiente' and channel = 'whatsapp');

grant select, insert, update on public.tool_idempotency to wa_bot;
drop policy if exists tool_idempotency_wa_bot on public.tool_idempotency;
create policy tool_idempotency_wa_bot on public.tool_idempotency for all to wa_bot using (true) with check (true);
