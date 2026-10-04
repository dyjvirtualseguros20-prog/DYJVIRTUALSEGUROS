-- ═══════════════════════════════════════════════════════════════════════════
--  INSTALACIÓN DE LA BASE DE DATOS (solicitudes de cotización + asesores)
--
--  Cómo usarlo:
--    1. Supabase → menú izquierdo → SQL Editor → "New query".
--    2. Copia TODO este archivo, pégalo y pulsa "Run".
--    3. Debe aparecer "Success. No rows returned".
--  Se puede ejecutar varias veces sin perder datos.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Administradores (asesores con acceso a /admin) ─────────────────────────
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Permisos explícitos (no se depende de los permisos automáticos de Supabase).
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;

-- Cada usuario autenticado solo puede comprobar su propia fila.
drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ¿El usuario de la sesión actual es administrador?
-- Vive en el esquema `private`, que no se publica en la API de Supabase.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
drop function if exists public.is_admin();

-- ─── Solicitudes de cotización ──────────────────────────────────────────────
create table if not exists public.quote_requests (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  insurance_type  text not null
    check (insurance_type in ('vehiculos', 'vida', 'hogar', 'salud', 'viajes', 'empresas')),
  full_name       text not null check (char_length(full_name) between 2 and 120),
  identification  text check (char_length(identification) <= 20),
  phone           text not null check (phone ~ '^[0-9]{10}$'),
  whatsapp        text not null check (whatsapp ~ '^[0-9]{11,15}$'),
  email           text not null check (char_length(email) <= 120),
  city            text check (char_length(city) <= 60),
  status          text not null default 'nueva_solicitud'
    check (status in ('nueva_solicitud', 'en_revision', 'cotizando', 'cotizado', 'contactado', 'vendido', 'cancelado')),
  form_data       jsonb not null default '{}'::jsonb,
  advisor_notes   text check (char_length(advisor_notes) <= 5000),
  quote_amount    numeric(14, 0) check (quote_amount >= 0),
  contacted_at    timestamptz,
  data_consent_at timestamptz not null default now()
);

create index if not exists quote_requests_created_at_idx on public.quote_requests (created_at desc);
create index if not exists quote_requests_status_idx on public.quote_requests (status);
create index if not exists quote_requests_insurance_type_idx on public.quote_requests (insurance_type);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quote_requests_set_updated_at on public.quote_requests;
create trigger quote_requests_set_updated_at
  before update on public.quote_requests
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Sin políticas para `anon`: el público NO puede leer, crear ni modificar filas
-- con la clave pública. Las solicitudes nuevas solo se crean con la función
-- public.submit_quote_request() (al final de este archivo).
alter table public.quote_requests enable row level security;

drop policy if exists "quote_requests_admin_select" on public.quote_requests;
create policy "quote_requests_admin_select" on public.quote_requests
  for select to authenticated
  using ((select private.is_admin()));

drop policy if exists "quote_requests_admin_update" on public.quote_requests;
create policy "quote_requests_admin_update" on public.quote_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Permisos: los asesores leen todo y solo modifican los campos de gestión.
revoke all on public.quote_requests from anon, authenticated;
grant select on public.quote_requests to authenticated;
grant update (status, advisor_notes, quote_amount, contacted_at) on public.quote_requests to authenticated;
-- service_role (clave secreta, opcional) conserva acceso total para tareas internas.
grant all on public.quote_requests to service_role;

-- ─── Registro de solicitudes (sin clave secreta) ────────────────────────────
-- Única forma en que un visitante puede escribir: INSERTA una solicitud con
-- estado fijo 'nueva_solicitud' y campos del asesor vacíos, y devuelve solo su
-- referencia. No permite leer ni modificar solicitudes existentes.
create or replace function public.submit_quote_request(
  p_reference text,
  p_insurance_type text,
  p_full_name text,
  p_identification text,
  p_phone text,
  p_whatsapp text,
  p_email text,
  p_city text,
  p_form_data jsonb
)
returns table (id uuid, reference text, status text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_reference !~ '^SOL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$' then
    raise exception 'referencia no valida' using errcode = '22023';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo no valido' using errcode = '22023';
  end if;
  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' or pg_column_size(p_form_data) > 8000 then
    raise exception 'datos del formulario no validos' using errcode = '22023';
  end if;

  return query
  insert into public.quote_requests as q
    (reference, insurance_type, full_name, identification, phone, whatsapp, email, city, form_data, status)
  values
    (p_reference, p_insurance_type, p_full_name, nullif(p_identification, ''), p_phone, p_whatsapp,
     lower(p_email), nullif(p_city, ''), p_form_data, 'nueva_solicitud')
  returning q.id, q.reference, q.status, q.created_at;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb) to anon, authenticated, service_role;
