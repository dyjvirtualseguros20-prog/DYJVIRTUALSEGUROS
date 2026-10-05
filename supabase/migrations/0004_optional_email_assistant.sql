-- ════════════════════════════════════════════════════════════════════════════
--  CORREO OPCIONAL SOLO PARA SOLICITUDES DEL ASESOR VIRTUAL
--  Las solicitudes del formulario (source = 'formulario') siguen exigiendo correo.
--  Misma firma de la función: compatible con la versión publicada.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.quote_requests alter column email drop not null;

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
  v_source text := coalesce(p_source, 'formulario');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if p_reference !~ '^SOL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$' then
    raise exception 'referencia no valida' using errcode = '22023';
  end if;
  if v_source not in ('formulario', 'asistente_ia') then
    raise exception 'origen no valido' using errcode = '22023';
  end if;
  -- Correo: obligatorio en el formulario; opcional en el asesor virtual (si viene, debe ser válido).
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

  select a.id into v_advisor
  from public.advisors a
  where a.id = lower(btrim(p_advisor_id)) and a.active;

  return query
  insert into public.quote_requests as q
    (reference, insurance_type, full_name, identification, phone, whatsapp, email, city, form_data, status, advisor_id, source)
  values
    (p_reference, p_insurance_type, p_full_name, nullif(p_identification, ''), p_phone, p_whatsapp,
     v_email, nullif(p_city, ''), p_form_data, 'nueva_solicitud', v_advisor, v_source)
  returning q.id, q.reference, q.status, q.created_at, q.advisor_id;
end;
$$;

notify pgrst, 'reload schema';
