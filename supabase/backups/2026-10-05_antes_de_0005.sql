-- ════════════════════════════════════════════════════════════════════════════
--  COPIA DE SEGURIDAD antes de la migración 0005 (5 de octubre de 2026)
--  Estado de lo que 0005 modifica. Para volver atrás, ver "REVERSIÓN" en
--  supabase/migrations/0005_consent_records.sql. La tabla tenía 0 filas.
-- ════════════════════════════════════════════════════════════════════════════

-- Columnas de public.quote_requests:
--   id uuid NOT NULL default gen_random_uuid()
--   reference text NOT NULL
--   created_at timestamptz NOT NULL default now()
--   updated_at timestamptz NOT NULL default now()
--   insurance_type text NOT NULL
--   full_name text NOT NULL
--   identification text NULL
--   phone text NOT NULL
--   whatsapp text NOT NULL
--   email text NULL
--   city text NULL
--   status text NOT NULL default 'nueva_solicitud'
--   form_data jsonb NOT NULL default '{}'
--   advisor_notes text NULL
--   quote_amount numeric NULL
--   contacted_at timestamptz NULL
--   data_consent_at timestamptz NOT NULL default now()
--   advisor_id text NULL
--   source text NOT NULL default 'formulario'

-- Función vigente (0005 la reemplaza por una versión con p_consent):
CREATE OR REPLACE FUNCTION public.submit_quote_request(p_reference text, p_insurance_type text, p_full_name text, p_identification text, p_phone text, p_whatsapp text, p_email text, p_city text, p_form_data jsonb, p_advisor_id text DEFAULT NULL::text, p_source text DEFAULT 'formulario'::text)
 RETURNS TABLE(id uuid, reference text, status text, created_at timestamp with time zone, advisor_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text)
  to anon, authenticated, service_role;
