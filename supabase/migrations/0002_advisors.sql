-- ═══════════════════════════════════════════════════════════════════════════
--  ASESORES Y ATRIBUCIÓN DE SOLICITUDES (enlaces personalizados /cristian, /...)
--
--  - Tabla `advisors`: un registro por asesor. Para agregar un asesor basta con
--    insertar una fila (Supabase → Table Editor → advisors → Insert row).
--  - `quote_requests.advisor_id`: asesor que originó la visita. Lo fija el
--    servidor al registrar la solicitud y los asesores NO pueden modificarlo.
--  Migración segura: solo agrega objetos; no borra ni modifica datos existentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Asesores ───────────────────────────────────────────────────────────────
create table if not exists public.advisors (
  -- Identificador que va en el enlace: https://.../cristian
  id         text primary key
    check (id ~ '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$')
    -- Palabras reservadas: rutas que ya existen en la web.
    check (id not in ('admin', 'api', 'cotizar', 'politica-de-privacidad', 'asesor', 'asesores',
                      'robots', 'sitemap', 'manifest', 'icon', 'apple-icon', 'opengraph-image',
                      'logo', 'aseguradoras', 'inicio', 'contacto', 'seguros', 'nosotros')),
  name       text not null check (char_length(name) between 2 and 80),
  -- URL pública de la foto (https). Opcional: sin foto se muestran las iniciales.
  photo_url  text check (photo_url is null or photo_url ~ '^https://'),
  -- WhatsApp con indicativo de país, solo dígitos (57 + 10 dígitos en Colombia).
  whatsapp   text not null check (whatsapp ~ '^[0-9]{11,15}$'),
  -- Teléfono de llamadas, si es distinto al WhatsApp (solo dígitos). Opcional.
  phone      text check (phone is null or phone ~ '^[0-9]{7,15}$'),
  -- Desactivar en vez de borrar: conserva el historial de solicitudes.
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists advisors_set_updated_at on public.advisors;
create trigger advisors_set_updated_at
  before update on public.advisors
  for each row execute function public.set_updated_at();

alter table public.advisors enable row level security;

-- Los datos públicos de un asesor activo (nombre, foto, WhatsApp) se muestran en la web.
revoke all on public.advisors from anon, authenticated;
grant select (id, name, photo_url, whatsapp, phone, active) on public.advisors to anon, authenticated;
grant all on public.advisors to service_role;

drop policy if exists "advisors_public_read_active" on public.advisors;
create policy "advisors_public_read_active" on public.advisors
  for select to anon, authenticated
  using (active);

-- El panel /admin ve también los asesores desactivados (para el historial).
drop policy if exists "advisors_admin_read_all" on public.advisors;
create policy "advisors_admin_read_all" on public.advisors
  for select to authenticated
  using ((select private.is_admin()));

-- ─── Atribución en las solicitudes ──────────────────────────────────────────
-- ON UPDATE CASCADE: si se cambia el identificador de un asesor, sus solicitudes lo siguen.
-- ON DELETE RESTRICT: no se puede borrar un asesor que tenga solicitudes (se desactiva).
alter table public.quote_requests
  add column if not exists advisor_id text
    references public.advisors (id) on update cascade on delete restrict;

create index if not exists quote_requests_advisor_id_idx on public.quote_requests (advisor_id);

-- advisor_id NO está en los permisos de UPDATE de los asesores (ver 0001): queda fijo.

-- ─── Registro de solicitudes con asesor ─────────────────────────────────────
-- Se reemplaza la función por una versión con el parámetro p_advisor_id
-- (opcional). Un identificador inexistente o inactivo se guarda como NULL.
drop function if exists public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb);

create or replace function public.submit_quote_request(
  p_reference text,
  p_insurance_type text,
  p_full_name text,
  p_identification text,
  p_phone text,
  p_whatsapp text,
  p_email text,
  p_city text,
  p_form_data jsonb,
  p_advisor_id text default null
)
returns table (id uuid, reference text, status text, created_at timestamptz, advisor_id text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_advisor text;
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

  select a.id into v_advisor
  from public.advisors a
  where a.id = lower(btrim(p_advisor_id)) and a.active;

  return query
  insert into public.quote_requests as q
    (reference, insurance_type, full_name, identification, phone, whatsapp, email, city, form_data, status, advisor_id)
  values
    (p_reference, p_insurance_type, p_full_name, nullif(p_identification, ''), p_phone, p_whatsapp,
     lower(p_email), nullif(p_city, ''), p_form_data, 'nueva_solicitud', v_advisor)
  returning q.id, q.reference, q.status, q.created_at, q.advisor_id;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text)
  to anon, authenticated, service_role;
