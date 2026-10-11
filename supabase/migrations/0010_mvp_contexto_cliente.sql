-- ═══════════════════════════════════════════════════════════════════════════
--  MVP DEL SÚPER ASESOR: CONTEXTO DEL CLIENTE
--
--  - advisors.central_base: asesores de la base central de D&J. Solo a ellos el canal
--    de WhatsApp les asigna clientes y solicitudes. Cristian = sí. Los demás (Jeisson)
--    quedan en false: su enlace web /jeisson sigue igual, pero WhatsApp no le asigna nada.
--  - chat_contact_requests: qué solicitudes nacieron de qué contacto/conversación de
--    WhatsApp (relación contacto ↔ solicitud ↔ conversación; el asesor está en la solicitud).
--  - public.wa_contact_requests(): lectura mínima para la IA (referencia, tipo, estado y
--    fechas) de las solicitudes de ESE contacto. Sin nombres, teléfonos ni documentos.
--    Solo la ejecuta wa_bot; wa_bot sigue sin poder leer quote_requests.
--
--  Migración segura: solo agrega objetos. Único cambio de datos: central_base = true en la
--  fila de Cristian. Rollback: supabase/backups/2026-10-11_antes_de_0010.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Base central de asesores ───────────────────────────────────────────────
alter table public.advisors add column if not exists central_base boolean not null default false;
update public.advisors set central_base = true where id = 'cristian' and not central_base;
grant select (central_base) on public.advisors to wa_bot;

-- ─── Contacto ↔ solicitudes ─────────────────────────────────────────────────
create table if not exists public.chat_contact_requests (
  quote_request_id uuid primary key references public.quote_requests (id) on delete restrict,
  contact_id       uuid not null references public.chat_contacts (id) on delete restrict,
  conversation_id  uuid not null references public.chat_conversations (id) on delete restrict,
  created_at       timestamptz not null default now()
);

create index if not exists chat_contact_requests_contact_idx on public.chat_contact_requests (contact_id, created_at desc);

alter table public.chat_contact_requests enable row level security;

revoke all on public.chat_contact_requests from anon, authenticated;
grant select on public.chat_contact_requests to authenticated;
grant all on public.chat_contact_requests to service_role;

-- Panel: se ve el vínculo solo si se ve la solicitud (RLS de quote_requests: admin todo,
-- asesor lo suyo).
drop policy if exists chat_contact_requests_staff_select on public.chat_contact_requests;
create policy chat_contact_requests_staff_select on public.chat_contact_requests
  for select to authenticated
  using (exists (select 1 from public.quote_requests q where q.id = chat_contact_requests.quote_request_id));

-- wa_bot: solo inserta el vínculo al registrar una solicitud (no lee la tabla).
grant insert on public.chat_contact_requests to wa_bot;
drop policy if exists chat_contact_requests_wa_bot_insert on public.chat_contact_requests;
create policy chat_contact_requests_wa_bot_insert on public.chat_contact_requests
  for insert to wa_bot with check (true);

-- ─── Lectura mínima para la IA ──────────────────────────────────────────────
create or replace function public.wa_contact_requests(p_contact_id uuid)
returns table (reference text, insurance_type text, status text, created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.reference, q.insurance_type, q.status, q.created_at, q.updated_at
  from public.chat_contact_requests l
  join public.quote_requests q on q.id = l.quote_request_id
  where l.contact_id = p_contact_id
  order by q.created_at desc
  limit 5;
$$;

revoke all on function public.wa_contact_requests(uuid) from public, anon, authenticated;
grant execute on function public.wa_contact_requests(uuid) to wa_bot;

-- ─── Nuevas acciones de la IA ───────────────────────────────────────────────
insert into public.tool_policies (action, note) values
  ('contexto.consultar_solicitudes', 'IA (LEER): estado real de las solicitudes del mismo contacto.'),
  ('solicitud.pedir_revision', 'IA solo propone: el cliente pide otra opción o revisar el precio.')
on conflict (action) do nothing;
