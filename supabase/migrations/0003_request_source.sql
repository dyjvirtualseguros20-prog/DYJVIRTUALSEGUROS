-- ════════════════════════════════════════════════════════════════════════════
--  ORIGEN DE LAS SOLICITUDES: formulario o asistente virtual con IA
--  Compatible con la versión publicada: el parámetro p_source es opcional y las
--  solicitudes existentes (y las que lleguen sin él) quedan como 'formulario'.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.quote_requests
  add column if not exists source text not null default 'formulario'
    check (source in ('formulario', 'asistente_ia'));

-- source NO está en los permisos de UPDATE de los asesores (ver 0001): queda fijo.

-- Se reemplaza la función (misma firma + p_source opcional). Se borra la anterior
-- para que no queden dos versiones que la API no sepa distinguir.
drop function if exists public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text);

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
  p_source text default 'formulario'
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
  if coalesce(p_source, 'formulario') not in ('formulario', 'asistente_ia') then
    raise exception 'origen no valido' using errcode = '22023';
  end if;

  select a.id into v_advisor
  from public.advisors a
  where a.id = lower(btrim(p_advisor_id)) and a.active;

  return query
  insert into public.quote_requests as q
    (reference, insurance_type, full_name, identification, phone, whatsapp, email, city, form_data, status, advisor_id, source)
  values
    (p_reference, p_insurance_type, p_full_name, nullif(p_identification, ''), p_phone, p_whatsapp,
     lower(p_email), nullif(p_city, ''), p_form_data, 'nueva_solicitud', v_advisor, coalesce(p_source, 'formulario'))
  returning q.id, q.reference, q.status, q.created_at, q.advisor_id;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
