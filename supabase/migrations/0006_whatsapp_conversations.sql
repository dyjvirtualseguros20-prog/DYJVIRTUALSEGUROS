-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 · Conversaciones (WhatsApp y, en el futuro, otros canales)
-- ───────────────────────────────────────────────────────────────────────────
-- 1. quote_requests.source acepta 'whatsapp' (no se modifican filas existentes).
-- 2. submit_quote_request() acepta source 'whatsapp' (correo opcional, como en el asistente IA).
-- 3. Tablas chat_contacts, chat_conversations, chat_messages y chat_consents.
-- 4. Rol wa_bot (Worker de WhatsApp) con permisos mínimos: solo estas tablas,
--    leer asesores y registrar solicitudes por la misma función que usa la web.
-- Copia previa: supabase/backups/2026-10-09_antes_de_0006.sql
-- Retención: NO hay borrado automático. created_at / updated_at / last_message_at /
-- closed_at permiten definir después una política de conservación.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Origen 'whatsapp' en las solicitudes ─────────────────────────────────
alter table public.quote_requests drop constraint if exists quote_requests_source_check;
alter table public.quote_requests
  add constraint quote_requests_source_check check (source = any (array['formulario', 'asistente_ia', 'whatsapp']));

-- ── 2. Función de registro: igual que antes + source 'whatsapp' ─────────────
create or replace function public.submit_quote_request(
  p_reference text, p_insurance_type text, p_full_name text, p_identification text, p_phone text,
  p_whatsapp text, p_email text, p_city text, p_form_data jsonb, p_advisor_id text default null,
  p_source text default 'formulario', p_consent jsonb default '{}'::jsonb
)
returns table (id uuid, reference text, status text, created_at timestamptz, advisor_id text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_advisor text;
  v_source text := coalesce(p_source, 'formulario');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_consent jsonb := coalesce(p_consent, '{}'::jsonb);
begin
  if p_reference !~ '^SOL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$' then
    raise exception 'referencia no valida' using errcode = '22023';
  end if;
  if v_source not in ('formulario', 'asistente_ia', 'whatsapp') then
    raise exception 'origen no valido' using errcode = '22023';
  end if;
  -- Solo el Worker de WhatsApp (rol wa_bot) puede registrar solicitudes con origen 'whatsapp'.
  if v_source = 'whatsapp' and session_user <> 'wa_bot' then
    raise exception 'origen no permitido' using errcode = '42501';
  end if;
  if v_email is null then
    if v_source not in ('asistente_ia', 'whatsapp') then
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

-- ── 3. Tablas de conversaciones ─────────────────────────────────────────────

-- Cliente en un canal (en WhatsApp, su número con indicativo, solo dígitos).
create table public.chat_contacts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'web')),
  external_id text not null check (char_length(external_id) between 3 and 64),
  display_name text check (char_length(display_name) <= 120),
  advisor_id text references public.advisors (id),
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_id),
  check (channel <> 'whatsapp' or external_id ~ '^[0-9]{8,15}$')
);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.chat_contacts (id),
  channel text not null check (channel in ('whatsapp', 'web')),
  status text not null default 'bot' check (status in ('bot', 'esperando_asesor', 'asesor', 'cerrada')),
  intent text check (intent in ('cotizacion', 'informacion', 'accidente', 'renovacion', 'reclamacion', 'asesor_humano', 'otro')),
  escalation_reason text check (escalation_reason in ('accidente', 'reclamacion', 'asesor_humano', 'baja_confianza')),
  -- Lo que el asistente ya sabe (LeadState): así no vuelve a preguntar lo que el cliente informó.
  lead_state jsonb not null default '{}'::jsonb check (jsonb_typeof(lead_state) = 'object' and pg_column_size(lead_state) <= 8000),
  -- Borrador completo esperando la confirmación y las autorizaciones del cliente.
  pending_action text check (pending_action in ('confirmar_solicitud')),
  quote_draft jsonb check (quote_draft is null or pg_column_size(quote_draft) <= 8000),
  quote_request_id uuid references public.quote_requests (id),
  assigned_advisor_id text references public.advisors (id),
  taken_by text check (char_length(taken_by) <= 120),
  taken_at timestamptz,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Una sola conversación abierta por contacto.
create unique index chat_conversations_one_open on public.chat_conversations (contact_id) where status <> 'cerrada';
create index chat_conversations_last_message_idx on public.chat_conversations (last_message_at desc);
create index chat_conversations_status_idx on public.chat_conversations (status);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id),
  direction text not null check (direction in ('entrante', 'saliente')),
  author text not null check (author in ('cliente', 'ia', 'asesor', 'sistema')),
  message_type text not null default 'texto' check (message_type in ('texto', 'audio', 'imagen', 'documento', 'interactivo', 'otro')),
  -- Texto ya sin datos de salud (se ocultan antes de guardar).
  body text check (char_length(body) <= 4096),
  health_redacted boolean not null default false,
  intent text check (intent in ('cotizacion', 'informacion', 'accidente', 'renovacion', 'reclamacion', 'asesor_humano', 'otro')),
  -- ID del mensaje en Meta (wamid) o de la simulación: evita procesar dos veces el mismo mensaje.
  external_id text unique check (char_length(external_id) <= 200),
  delivery_status text check (delivery_status in ('recibido', 'simulado', 'enviado', 'entregado', 'leido', 'fallido')),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);

-- Registro técnico de autorizaciones dadas por chat (el texto jurídico definitivo se incorporará después).
create table public.chat_consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.chat_contacts (id),
  conversation_id uuid references public.chat_conversations (id),
  channel text not null check (channel in ('whatsapp', 'web')),
  -- A = política y términos · B = tratamiento para la cotización · C = envío a aseguradoras
  consent_type text not null check (consent_type in ('politica_terminos', 'tratamiento_datos', 'envio_aseguradoras')),
  granted boolean not null,
  privacy_policy_version text not null check (char_length(privacy_policy_version) <= 20),
  terms_version text not null check (char_length(terms_version) <= 20),
  -- Versión del mensaje de autorización mostrado en el chat.
  consent_text_version text not null check (char_length(consent_text_version) <= 60),
  evidence_message_id uuid references public.chat_messages (id),
  created_at timestamptz not null default now()
);
create index chat_consents_contact_idx on public.chat_consents (contact_id, created_at);

-- updated_at automático (función existente de 0001)
create trigger chat_contacts_set_updated_at before update on public.chat_contacts
  for each row execute function public.set_updated_at();
create trigger chat_conversations_set_updated_at before update on public.chat_conversations
  for each row execute function public.set_updated_at();
create trigger chat_messages_set_updated_at before update on public.chat_messages
  for each row execute function public.set_updated_at();

-- ── 4. Seguridad ────────────────────────────────────────────────────────────
alter table public.chat_contacts enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_consents enable row level security;

-- Sin acceso público (Supabase concede permisos por defecto en "public": se retiran).
revoke all on public.chat_contacts, public.chat_conversations, public.chat_messages, public.chat_consents
  from anon, authenticated;

-- Panel /admin: los administradores leen todo; solo pueden cambiar el estado y la asignación.
grant select on public.chat_contacts, public.chat_conversations, public.chat_messages, public.chat_consents to authenticated;
grant update (status, assigned_advisor_id, taken_by, taken_at, closed_at) on public.chat_conversations to authenticated;

create policy chat_contacts_admin_select on public.chat_contacts for select to authenticated using ((select private.is_admin()));
create policy chat_conversations_admin_select on public.chat_conversations for select to authenticated using ((select private.is_admin()));
create policy chat_conversations_admin_update on public.chat_conversations for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy chat_messages_admin_select on public.chat_messages for select to authenticated using ((select private.is_admin()));
create policy chat_consents_admin_select on public.chat_consents for select to authenticated using ((select private.is_admin()));

-- Rol del Worker de WhatsApp. Se crea SIN contraseña (NOLOGIN): el dueño la define fuera del chat.
create role wa_bot nologin noinherit;
grant usage on schema public to wa_bot;
grant select, insert, update on public.chat_contacts, public.chat_conversations, public.chat_messages to wa_bot;
grant select, insert on public.chat_consents to wa_bot;
grant select (id, name, active) on public.advisors to wa_bot;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text, text, jsonb, text, text, jsonb) to wa_bot;

create policy chat_contacts_wa_bot on public.chat_contacts for all to wa_bot using (true) with check (true);
create policy chat_conversations_wa_bot on public.chat_conversations for all to wa_bot using (true) with check (true);
create policy chat_messages_wa_bot on public.chat_messages for all to wa_bot using (true) with check (true);
create policy chat_consents_wa_bot on public.chat_consents for all to wa_bot using (true) with check (true);
create policy advisors_wa_bot_read on public.advisors for select to wa_bot using (true);
