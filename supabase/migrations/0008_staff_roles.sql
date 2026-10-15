-- ═══════════════════════════════════════════════════════════════════════════
--  CUENTAS Y ROLES DEL PANEL /admin (paso 2.4)
--
--  - `staff_users`: una fila por persona con acceso al panel. Roles:
--      admin_principal → ve y gestiona todo (lo que hoy significa "admin").
--      asesor          → solo las solicitudes y conversaciones asignadas a su
--                        `advisor_id`. Nunca la cartera completa.
--  - Nadie puede crearse ni modificarse una cuenta de staff desde la API: no hay
--    permisos de INSERT/UPDATE/DELETE para `anon` ni `authenticated`. Las cuentas
--    las crea el administrador desde Supabase (SQL o service_role).
--  - Un usuario que se registre en Supabase Auth por su cuenta no tiene fila en
--    staff_users → no ve nada.
--  - `active = false` corta el acceso de inmediato (base de datos y panel).
--  - private.is_admin() conserva su significado: "administrador principal activo".
--    Desde ahora se lee de staff_users. `admin_users` se conserva sin cambios
--    (compatibilidad); la cuenta que había allí pasa a admin_principal.
--
--  Migración segura: solo agrega objetos y una fila por cada admin existente.
--  No borra ni modifica datos. Rollback: supabase/backups/2026-10-11_antes_de_0008.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tabla de cuentas del panel ─────────────────────────────────────────────
create table if not exists public.staff_users (
  -- RESTRICT: no se puede borrar el usuario de Auth mientras tenga cuenta de staff
  -- (para quitar acceso se desactiva; el historial se conserva).
  user_id        uuid primary key references auth.users (id) on delete restrict,
  role           text not null check (role in ('admin_principal', 'asesor')),
  -- Asesor al que pertenece la cuenta. Obligatorio para el rol asesor.
  advisor_id     text references public.advisors (id) on update cascade on delete restrict,
  display_name   text check (display_name is null or char_length(display_name) between 2 and 80),
  active         boolean not null default true,
  deactivated_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint staff_users_asesor_requiere_advisor check (role <> 'asesor' or advisor_id is not null)
);

-- Una sola cuenta por asesor.
create unique index if not exists staff_users_advisor_id_key on public.staff_users (advisor_id) where advisor_id is not null;

drop trigger if exists staff_users_set_updated_at on public.staff_users;
create trigger staff_users_set_updated_at
  before update on public.staff_users
  for each row execute function public.set_updated_at();

-- Protección: el panel nunca se queda sin un administrador principal activo, y
-- deactivated_at refleja cuándo se desactivó la cuenta.
create or replace function private.staff_users_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin_principal' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin_principal' or not new.active)
     and not exists (
       select 1 from public.staff_users s
       where s.role = 'admin_principal' and s.active and s.user_id <> old.user_id
     ) then
    raise exception 'No se puede dejar el panel sin un administrador principal activo.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  if old.active and not new.active then
    new.deactivated_at := now();
  elsif new.active then
    new.deactivated_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.staff_users_guard() from public, anon, authenticated;

drop trigger if exists staff_users_guard on public.staff_users;
create trigger staff_users_guard
  before update or delete on public.staff_users
  for each row execute function private.staff_users_guard();

-- ─── Funciones de sesión (esquema private, no expuesto en la API) ───────────
-- Solo cuentan las cuentas ACTIVAS.

-- ¿Administrador principal activo? (mismo significado que antes)
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_users
    where user_id = (select auth.uid()) and role = 'admin_principal' and active
  );
$$;

-- Asesor de la sesión (solo rol asesor activo; null en cualquier otro caso).
create or replace function private.current_advisor_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select advisor_id from public.staff_users
  where user_id = (select auth.uid()) and role = 'asesor' and active;
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.current_advisor_id() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_advisor_id() to authenticated;

-- ─── Permisos y RLS de staff_users ──────────────────────────────────────────
alter table public.staff_users enable row level security;

revoke all on public.staff_users from anon, authenticated;
grant select on public.staff_users to authenticated;
grant all on public.staff_users to service_role;

-- Cada usuario ve su propia cuenta; el administrador principal ve todas.
drop policy if exists staff_users_select on public.staff_users;
create policy staff_users_select on public.staff_users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ─── Cuentas existentes: el administrador actual pasa a admin_principal ─────
insert into public.staff_users (user_id, role)
select user_id, 'admin_principal' from public.admin_users
on conflict (user_id) do nothing;

-- ─── Acceso del rol asesor (solo lo asignado a su advisor_id) ───────────────
-- Las políticas del administrador (0001, 0006) no cambian; estas se suman.

-- Solicitudes atribuidas a su asesor. Solo puede cambiar los campos de gestión
-- (permisos de columna de 0001); advisor_id sigue sin poder modificarse.
drop policy if exists quote_requests_asesor_select on public.quote_requests;
create policy quote_requests_asesor_select on public.quote_requests
  for select to authenticated
  using (advisor_id = (select private.current_advisor_id()));

drop policy if exists quote_requests_asesor_update on public.quote_requests;
create policy quote_requests_asesor_update on public.quote_requests
  for update to authenticated
  using (advisor_id = (select private.current_advisor_id()))
  with check (advisor_id = (select private.current_advisor_id()));

-- Conversaciones asignadas a su asesor. No puede reasignarlas a otro ni soltarlas.
drop policy if exists chat_conversations_asesor_select on public.chat_conversations;
create policy chat_conversations_asesor_select on public.chat_conversations
  for select to authenticated
  using (assigned_advisor_id = (select private.current_advisor_id()));

drop policy if exists chat_conversations_asesor_update on public.chat_conversations;
create policy chat_conversations_asesor_update on public.chat_conversations
  for update to authenticated
  using (assigned_advisor_id = (select private.current_advisor_id()))
  with check (assigned_advisor_id = (select private.current_advisor_id()));

-- Mensajes, autorizaciones y contacto: solo de esas conversaciones.
drop policy if exists chat_messages_asesor_select on public.chat_messages;
create policy chat_messages_asesor_select on public.chat_messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id and c.assigned_advisor_id = (select private.current_advisor_id())
  ));

drop policy if exists chat_consents_asesor_select on public.chat_consents;
create policy chat_consents_asesor_select on public.chat_consents
  for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = chat_consents.conversation_id and c.assigned_advisor_id = (select private.current_advisor_id())
  ));

drop policy if exists chat_contacts_asesor_select on public.chat_contacts;
create policy chat_contacts_asesor_select on public.chat_contacts
  for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.contact_id = chat_contacts.id and c.assigned_advisor_id = (select private.current_advisor_id())
  ));
