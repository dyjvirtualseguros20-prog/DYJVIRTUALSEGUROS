-- ════════════════════════════════════════════════════════════════════════════
--  REGISTRO DE AUTORIZACIONES Y PREPARACIÓN PARA APIS DE ASEGURADORAS
--  No destructiva: agrega una columna y una tabla vacía; reemplaza la función de
--  registro por una versión con un parámetro opcional más (compatible con la web publicada).
--
--  1) quote_requests.consent (jsonb): qué autorizó el cliente, cuándo y con qué versión de la
--     política y de los términos. Lo arma el SERVIDOR (no el navegador). Ejemplo:
--     {"privacy_policy_version":"2.0","terms_version":"1.0","accepted_at":"…","source":"formulario",
--      "privacy_policy_read":true,"data_processing":true,"insurer_transfer":false}
--  2) insurer_transmissions: bitácora de qué datos (solo NOMBRES de campos, nunca valores) se
--     enviaron a qué aseguradora, cuándo y con qué autorización. Vacía hasta conectar APIs.
--
--  Copia previa: supabase/backups/2026-10-05_antes_de_0005.sql
--  REVERSIÓN (si fuera necesaria):
--    drop table if exists public.insurer_transmissions;
--    alter table public.quote_requests drop column if exists consent;
--    drop function if exists public.submit_quote_request(text,text,text,text,text,text,text,text,jsonb,text,text,jsonb);
--    -- y volver a crear la función de la copia previa (incluye sus permisos).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.quote_requests
  add column if not exists consent jsonb not null default '{}'::jsonb;

-- consent NO está en los permisos de UPDATE de los asesores (ver 0001): queda fijo.

create table if not exists public.insurer_transmissions (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references public.quote_requests (id) on delete restrict,
  insurer           text not null check (char_length(insurer) between 2 and 80),
  fields_sent       text[] not null default '{}',
  consent_version   text,
  status            text not null default 'enviado' check (status in ('enviado', 'respondido', 'error')),
  response_summary  jsonb,
  sent_at           timestamptz not null default now()
);

create index if not exists insurer_transmissions_request_idx on public.insurer_transmissions (quote_request_id);

alter table public.insurer_transmissions enable row level security;
revoke all on public.insurer_transmissions from anon, authenticated;
grant select on public.insurer_transmissions to authenticated;
grant all on public.insurer_transmissions to service_role;

drop policy if exists "insurer_transmissions_admin_select" on public.insurer_transmissions;
create policy "insurer_transmissions_admin_select" on public.insurer_transmissions
  for select to authenticated
  using ((select private.is_admin()));

drop function if exists public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text);

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
  p_advisor_id text default null,
  p_source text default 'formulario',
  p_consent jsonb default '{}'::jsonb
)
returns table (id uuid, reference text, status text, created_at timestamptz, advisor_id text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_advisor text;
  v_source text := coalesce(p_source, 'formulario');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_consent jsonb := coalesce(p_consent, '{}'::jsonb);
begin
  if p_reference !~ '^SOL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$' then
    raise exception 'referencia no valida' using errcode = '22023';
  end if;
  if v_source not in ('formulario', 'asistente_ia') then
    raise exception 'origen no valido' using errcode = '22023';
  end if;
  if v_email is null then
    if v_source <> 'asistente_ia' then
      raise exception 'correo no valido' using errcode = '22023';
    end if;
  elsif v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo no valido' using errcode = '22023';
  end if;
  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' or pg_column_size(p_form_data) > 8000 then
    raise exception 'datos del formulario no validos' using errcode = '22023';
  end if;
  if jsonb_typeof(v_consent) <> 'object' or pg_column_size(v_consent) > 2000 then
    raise exception 'autorizaciones no validas' using errcode = '22023';
  end if;

  select a.id into v_advisor
  from public.advisors a
  where a.id = lower(btrim(p_advisor_id)) and a.active;

  return query
  insert into public.quote_requests as q
    (reference, insurance_type, full_name, identification, phone, whatsapp, email, city, form_data, status, advisor_id, source, consent)
  values
    (p_reference, p_insurance_type, p_full_name, nullif(p_identification, ''), p_phone, p_whatsapp,
     v_email, nullif(p_city, ''), p_form_data, 'nueva_solicitud', v_advisor, v_source, v_consent)
  returning q.id, q.reference, q.status, q.created_at, q.advisor_id;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text, jsonb) from public;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text, jsonb)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
