-- Copia de los objetos que modifica la migración 0006 (WhatsApp), tomada el 2026-10-09
-- ANTES de aplicarla. quote_requests tenía 0 filas en ese momento (no hay datos que respaldar).
-- Para volver atrás: ejecutar este archivo (restaura la regla de `source` y la función original).

alter table public.quote_requests drop constraint if exists quote_requests_source_check;
alter table public.quote_requests add constraint quote_requests_source_check CHECK ((source = ANY (ARRAY['formulario'::text, 'asistente_ia'::text])));

CREATE OR REPLACE FUNCTION public.submit_quote_request(p_reference text, p_insurance_type text, p_full_name text, p_identification text, p_phone text, p_whatsapp text, p_email text, p_city text, p_form_data jsonb, p_advisor_id text DEFAULT NULL::text, p_source text DEFAULT 'formulario'::text, p_consent jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, reference text, status text, created_at timestamp with time zone, advisor_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- Permisos de la función en ese momento: anon, authenticated, postgres, service_role (EXECUTE).
