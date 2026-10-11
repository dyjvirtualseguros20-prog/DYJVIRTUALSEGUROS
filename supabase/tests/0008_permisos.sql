-- ═══════════════════════════════════════════════════════════════════════════
--  PRUEBAS DE PERMISOS (paso 2.4) — cuentas y roles del panel
--
--  Se ejecuta COMPLETO como una sola consulta. Crea usuarios y datos de prueba,
--  actúa como cada rol (simulando la sesión con request.jwt.claims, igual que la
--  API de Supabase) y al final LANZA UN ERROR A PROPÓSITO con el resultado:
--  así toda la transacción se deshace y no queda ningún dato de prueba.
--
--    Resultado esperado:  ERROR:  RESULTADO_PERMISOS ok=70 fallos=0
--    (La sección W —rol wa_bot— se omite si la sesión no puede asumir ese rol.)
--
--  No toca datos reales: solo lee cuántas solicitudes tiene cada asesor real
--  para comprobar que no cambian. No usa a Jeisson ni a Cristian: los asesores de
--  prueba (prueba-a, prueba-b, prueba-c) se crean inactivos y se deshacen.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_owner uuid := (select user_id from public.staff_users where role = 'admin_principal' and active order by created_at limit 1);
  ua uuid := gen_random_uuid(); -- asesor A (prueba-a)
  ub uuid := gen_random_uuid(); -- asesor B (prueba-b)
  ui uuid := gen_random_uuid(); -- asesor inactivo (prueba-c)
  ux uuid := gen_random_uuid(); -- se registró en Auth por su cuenta (sin cuenta de staff)
  ut uuid := gen_random_uuid(); -- segundo admin_principal de prueba
  qa uuid; qb uuid; qc uuid; qn uuid;
  ca uuid; cb uuid; conva uuid; convb uuid;
  v_yo text := current_user;
  v_wa boolean;
  notas text[] := '{}';
  n int;
  t text;
  ok int := 0;
  fallos text[] := '{}';
  jeisson_antes int := (select count(*) from public.quote_requests where advisor_id = 'jeisson');
  staff_jeisson int := (select count(*) from public.staff_users where advisor_id = 'jeisson');
begin
  -- ─── Preparación (como postgres) ───────────────────────────────────────────
  if v_owner is null then raise exception 'No hay admin_principal activo'; end if;

  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba-asesor-a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba-asesor-b@example.com', 'authenticated', 'authenticated'),
    (ui, 'prueba-asesor-c@example.com', 'authenticated', 'authenticated'),
    (ux, 'prueba-registro@example.com', 'authenticated', 'authenticated'),
    (ut, 'prueba-admin@example.com', 'authenticated', 'authenticated');

  insert into public.advisors (id, name, whatsapp, active) values
    ('prueba-a', 'Prueba Asesor A', '573000000001', false),
    ('prueba-b', 'Prueba Asesor B', '573000000002', false),
    ('prueba-c', 'Prueba Asesor C', '573000000003', false);

  insert into public.staff_users (user_id, role, advisor_id, active) values
    (ua, 'asesor', 'prueba-a', true),
    (ub, 'asesor', 'prueba-b', true),
    (ui, 'asesor', 'prueba-c', false);

  insert into public.quote_requests (reference, insurance_type, full_name, phone, whatsapp, email, advisor_id)
    values ('SOL-PRBAAA', 'vehiculos', 'Prueba Cliente A', '3000000001', '573000000001', 'prueba@example.com', 'prueba-a')
    returning id into qa;
  insert into public.quote_requests (reference, insurance_type, full_name, phone, whatsapp, email, advisor_id)
    values ('SOL-PRBBBB', 'vehiculos', 'Prueba Cliente B', '3000000002', '573000000002', 'prueba@example.com', 'prueba-b')
    returning id into qb;
  insert into public.quote_requests (reference, insurance_type, full_name, phone, whatsapp, email, advisor_id)
    values ('SOL-PRBCCC', 'vehiculos', 'Prueba Cliente C', '3000000003', '573000000003', 'prueba@example.com', 'prueba-c')
    returning id into qc;
  insert into public.quote_requests (reference, insurance_type, full_name, phone, whatsapp, email, advisor_id)
    values ('SOL-PRBNNN', 'vehiculos', 'Prueba Sin Asesor', '3000000004', '573000000004', 'prueba@example.com', null)
    returning id into qn;

  insert into public.chat_contacts (channel, external_id, display_name) values ('whatsapp', '573000000901', 'Prueba Contacto A') returning id into ca;
  insert into public.chat_contacts (channel, external_id, display_name) values ('whatsapp', '573000000902', 'Prueba Contacto B') returning id into cb;
  insert into public.chat_conversations (contact_id, channel, assigned_advisor_id) values (ca, 'whatsapp', 'prueba-a') returning id into conva;
  insert into public.chat_conversations (contact_id, channel, assigned_advisor_id) values (cb, 'whatsapp', 'prueba-b') returning id into convb;
  insert into public.chat_messages (conversation_id, direction, author, body, external_id, is_simulated) values
    (conva, 'entrante', 'cliente', 'Prueba mensaje A', 'prueba-permisos-a', true),
    (convb, 'entrante', 'cliente', 'Prueba mensaje B', 'prueba-permisos-b', true);
  insert into public.chat_consents (contact_id, conversation_id, channel, consent_type, granted, privacy_policy_version, terms_version, consent_text_version) values
    (ca, conva, 'whatsapp', 'tratamiento_datos', true, 'prueba', 'prueba', 'prueba'),
    (cb, convb, 'whatsapp', 'tratamiento_datos', true, 'prueba', 'prueba', 'prueba');

  -- Para actuar como un usuario se fija la sesión igual que la API de Supabase:
  -- request.jwt.claims (auth.uid()) + rol authenticated/anon. v_yo = rol original.

  -- ═══ 1. ADMINISTRADOR PRINCIPAL (tu cuenta real, sesión simulada) ═══════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  if private.is_admin() then ok := ok + 1; else fallos := fallos || text 'O1 is_admin del dueño'; end if;
  select count(*) into n from public.quote_requests where reference like 'SOL-PRB%';
  if n = 4 then ok := ok + 1; else fallos := fallos || format('O2 dueño ve %s/4 solicitudes', n); end if;
  select count(*) into n from public.chat_conversations where id in (conva, convb);
  if n = 2 then ok := ok + 1; else fallos := fallos || format('O3 dueño ve %s/2 conversaciones', n); end if;
  select count(*) into n from public.chat_messages where external_id like 'prueba-permisos-%';
  if n = 2 then ok := ok + 1; else fallos := fallos || format('O4 dueño ve %s/2 mensajes', n); end if;
  select count(*) into n from public.chat_contacts where id in (ca, cb);
  if n = 2 then ok := ok + 1; else fallos := fallos || format('O5 dueño ve %s/2 contactos', n); end if;
  select count(*) into n from public.chat_consents where contact_id in (ca, cb);
  if n = 2 then ok := ok + 1; else fallos := fallos || format('O6 dueño ve %s/2 autorizaciones', n); end if;
  select count(*) into n from public.staff_users where user_id in (v_owner, ua, ub, ui);
  if n = 4 then ok := ok + 1; else fallos := fallos || format('O7 dueño ve %s/4 cuentas', n); end if;
  select count(*) into n from public.advisors where id like 'prueba-%';
  if n = 3 then ok := ok + 1; else fallos := fallos || format('O8 dueño ve %s/3 asesores inactivos', n); end if;
  update public.quote_requests set status = 'en_revision' where id = qb;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'O9 dueño no pudo actualizar solicitud'; end if;
  update public.chat_conversations set assigned_advisor_id = 'prueba-a' where id = convb;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'O10 dueño no pudo reasignar'; end if;
  update public.chat_conversations set assigned_advisor_id = 'prueba-b' where id = convb;
  select count(*) into n from public.admin_users where user_id = v_owner;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'O11 admin_users del dueño'; end if;
  -- Ni siquiera el dueño modifica cuentas desde la API (solo desde Supabase).
  begin
    update public.staff_users set display_name = 'Prueba' where user_id = ua;
    fallos := fallos || text 'O12 la API permitió modificar staff_users';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- ═══ 2. ASESOR A ═══════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  if not private.is_admin() then ok := ok + 1; else fallos := fallos || text 'A1 asesor es admin'; end if;
  if private.current_advisor_id() = 'prueba-a' then ok := ok + 1; else fallos := fallos || text 'A2 advisor_id de la sesión'; end if;
  select count(*) into n from public.quote_requests;
  if n = 1 then ok := ok + 1; else fallos := fallos || format('A3 asesor ve %s solicitudes (esperado 1: la suya)', n); end if;
  select count(*) into n from public.quote_requests where id = qa;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'A4 asesor no ve su solicitud'; end if;
  select count(*) into n from public.quote_requests where id in (qb, qc, qn);
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'A5 asesor ve solicitudes ajenas o sin asesor'; end if;
  select count(*) into n from public.quote_requests where advisor_id in ('cristian', 'jeisson');
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'A6 asesor ve solicitudes de asesores reales'; end if;
  update public.quote_requests set status = 'cotizando', advisor_notes = 'Prueba' where id = qa;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'A7 asesor no pudo gestionar su solicitud'; end if;
  update public.quote_requests set status = 'cancelado' where id in (qb, qn);
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'A8 asesor modificó solicitudes ajenas'; end if;
  begin
    update public.quote_requests set advisor_id = 'prueba-b' where id = qa;
    fallos := fallos || text 'A9 asesor cambió advisor_id de una solicitud';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    insert into public.quote_requests (reference, insurance_type, full_name, phone, whatsapp, email)
      values ('SOL-PRBXXX', 'vehiculos', 'Prueba', '3000000009', '573000000009', 'prueba@example.com');
    fallos := fallos || text 'A10 asesor insertó solicitud directa';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    delete from public.quote_requests where id = qa;
    fallos := fallos || text 'A11 asesor borró solicitud';
  exception when insufficient_privilege then ok := ok + 1; end;

  select count(*) into n from public.chat_conversations;
  if n = 1 then ok := ok + 1; else fallos := fallos || format('A12 asesor ve %s conversaciones (esperado 1)', n); end if;
  select count(*) into n from public.chat_messages;
  select string_agg(external_id, ',') into t from public.chat_messages;
  if n = 1 and t = 'prueba-permisos-a' then ok := ok + 1; else fallos := fallos || format('A13 asesor ve mensajes: %s', t); end if;
  select count(*) into n from public.chat_contacts;
  if n = 1 then ok := ok + 1; else fallos := fallos || format('A14 asesor ve %s contactos (esperado 1)', n); end if;
  select count(*) into n from public.chat_consents;
  if n = 1 then ok := ok + 1; else fallos := fallos || format('A15 asesor ve %s autorizaciones (esperado 1)', n); end if;
  update public.chat_conversations set status = 'asesor' where id = conva;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'A16 asesor no pudo gestionar su conversación'; end if;
  update public.chat_conversations set status = 'cerrada' where id = convb;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'A17 asesor modificó conversación ajena'; end if;
  begin
    update public.chat_conversations set assigned_advisor_id = 'prueba-b' where id = conva;
    fallos := fallos || text 'A18 asesor reasignó su conversación a otro';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.chat_conversations set assigned_advisor_id = null where id = conva;
    fallos := fallos || text 'A19 asesor soltó su conversación';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.chat_conversations set lead_state = '{}'::jsonb where id = conva;
    fallos := fallos || text 'A20 asesor modificó lead_state';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- Cuentas: solo la suya, sin poder cambiar rol, advisor_id ni volverse admin.
  select count(*) into n from public.staff_users;
  if n = 1 then ok := ok + 1; else fallos := fallos || format('A21 asesor ve %s cuentas (esperado 1)', n); end if;
  begin
    update public.staff_users set role = 'admin_principal' where user_id = ua;
    fallos := fallos || text 'A22 asesor se volvió admin_principal';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.staff_users set advisor_id = 'prueba-b' where user_id = ua;
    fallos := fallos || text 'A23 asesor cambió su advisor_id';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.staff_users set active = true where user_id = ui;
    fallos := fallos || text 'A24 asesor reactivó otra cuenta';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    insert into public.staff_users (user_id, role) values (ua, 'admin_principal');
    fallos := fallos || text 'A25 asesor insertó cuenta';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    delete from public.staff_users where user_id = ua;
    fallos := fallos || text 'A26 asesor borró cuenta';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    insert into public.admin_users (user_id) values (ua);
    fallos := fallos || text 'A27 asesor se agregó a admin_users';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.advisors set active = true where id = 'prueba-a';
    fallos := fallos || text 'A28 asesor modificó advisors';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.insurer_transmissions;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'A29 asesor ve envíos a aseguradoras'; end if;
  begin
    perform 1 from instagram.publicaciones limit 1;
    fallos := fallos || text 'A30 asesor lee el esquema instagram';
  exception when insufficient_privilege or invalid_schema_name or undefined_table then ok := ok + 1; end;

  -- ═══ 3. ASESOR B: no ve lo de A ════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  select count(*) into n from public.quote_requests where id = qa;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'B1 asesor B ve la solicitud de A'; end if;
  select count(*) into n from public.chat_messages where external_id = 'prueba-permisos-a';
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'B2 asesor B ve mensajes de A'; end if;
  select count(*) into n from public.quote_requests where id = qb;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'B3 asesor B no ve su solicitud'; end if;

  -- ═══ 4. ASESOR INACTIVO ════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ui, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  if private.current_advisor_id() is null and not private.is_admin() then ok := ok + 1; else fallos := fallos || text 'I1 inactivo conserva rol'; end if;
  select count(*) into n from public.quote_requests where id = qc;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'I2 inactivo ve su solicitud'; end if;

  -- Desactivar a A corta el acceso de inmediato; reactivarlo lo devuelve.
  perform set_config('role', v_yo, true);
  update public.staff_users set active = false where user_id = ua;
  select count(*) into n from public.staff_users where user_id = ua and deactivated_at is not null;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'I3 deactivated_at no se registró'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  select count(*) into n from public.quote_requests;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'I4 asesor desactivado sigue viendo solicitudes'; end if;
  select count(*) into n from public.chat_conversations;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'I5 asesor desactivado sigue viendo conversaciones'; end if;
  perform set_config('role', v_yo, true);
  update public.staff_users set active = true where user_id = ua;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  select count(*) into n from public.quote_requests;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'I6 reactivado no recupera acceso'; end if;

  -- ═══ 5. REGISTRO PÚBLICO SIN CUENTA DE STAFF ═══════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ux, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  select count(*) into n from public.quote_requests;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X1 registrado ve solicitudes'; end if;
  select count(*) into n from public.chat_conversations;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X2 registrado ve conversaciones'; end if;
  select count(*) into n from public.chat_contacts;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X3 registrado ve contactos'; end if;
  select count(*) into n from public.staff_users;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X4 registrado ve cuentas'; end if;
  if not private.is_admin() and private.current_advisor_id() is null then ok := ok + 1; else fallos := fallos || text 'X5 registrado tiene rol'; end if;
  begin
    insert into public.staff_users (user_id, role, advisor_id) values (ux, 'asesor', 'prueba-c');
    fallos := fallos || text 'X6 registrado se creó cuenta de asesor';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.advisors where not active;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X7 registrado ve asesores inactivos'; end if;

  -- ═══ 6. VISITANTE ANÓNIMO (clave pública) ══════════════════════════════════
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true);
  begin
    perform 1 from public.staff_users limit 1;
    fallos := fallos || text 'N1 anon lee staff_users';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform 1 from public.quote_requests limit 1;
    fallos := fallos || text 'N2 anon lee quote_requests';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform private.current_advisor_id();
    fallos := fallos || text 'N3 anon ejecuta funciones privadas';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- ═══ 7. wa_bot sin cambios ═════════════════════════════════════════════════
  -- (Solo si este usuario puede asumir el rol wa_bot; si no, se anota como omitida.)
  begin
    perform set_config('role', 'wa_bot', true);
    v_wa := true;
  exception when insufficient_privilege then v_wa := false; end;
  if v_wa then
    perform set_config('role', 'wa_bot', true);
    begin
      perform 1 from public.staff_users limit 1;
      fallos := fallos || text 'W1 wa_bot lee staff_users';
    exception when insufficient_privilege then ok := ok + 1; end;
    select count(*) into n from public.chat_conversations where id in (conva, convb);
    if n = 2 then ok := ok + 1; else fallos := fallos || text 'W2 wa_bot perdió acceso a conversaciones'; end if;
  else
    notas := notas || text 'W omitida: no se puede asumir wa_bot desde esta sesión';
  end if;

  -- ═══ 8. Restricciones de la tabla (como postgres) ══════════════════════════
  perform set_config('role', v_yo, true);
  begin
    update public.staff_users set active = false where user_id = v_owner;
    fallos := fallos || text 'R1 se pudo desactivar al único admin_principal';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.staff_users set role = 'asesor', advisor_id = 'prueba-c' where user_id = v_owner;
    fallos := fallos || text 'R2 se pudo degradar al único admin_principal';
  exception when insufficient_privilege or unique_violation then ok := ok + 1; end;
  begin
    delete from public.staff_users where user_id = v_owner;
    fallos := fallos || text 'R3 se pudo borrar al único admin_principal';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    insert into public.staff_users (user_id, role) values (ux, 'asesor');
    fallos := fallos || text 'R4 asesor sin advisor_id';
  exception when check_violation then ok := ok + 1; end;
  begin
    insert into public.staff_users (user_id, role, advisor_id) values (ux, 'asesor', 'prueba-a');
    fallos := fallos || text 'R5 dos cuentas para el mismo asesor';
  exception when unique_violation then ok := ok + 1; end;
  begin
    delete from auth.users where id = ua;
    fallos := fallos || text 'R6 se borró un usuario de Auth con cuenta de staff';
  exception when foreign_key_violation then ok := ok + 1; end;
  -- Con un segundo admin activo, desactivar uno sí se permite.
  insert into public.staff_users (user_id, role) values (ut, 'admin_principal');
  update public.staff_users set active = false where user_id = ut;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'R7 no se pudo desactivar un admin secundario'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ut, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true);
  if not private.is_admin() then ok := ok + 1; else fallos := fallos || text 'R8 admin desactivado sigue siendo admin'; end if;
  perform set_config('role', v_yo, true);

  -- ═══ 9. Jeisson y datos reales sin cambios ═════════════════════════════════
  if (select count(*) from public.quote_requests where advisor_id = 'jeisson') = jeisson_antes
     and (select count(*) from public.staff_users where advisor_id = 'jeisson') = staff_jeisson and staff_jeisson = 0
  then ok := ok + 1; else fallos := fallos || text 'J1 cambió algo de Jeisson'; end if;

  raise exception 'RESULTADO_PERMISOS ok=% fallos=% % || notas: %', ok, coalesce(array_length(fallos, 1), 0),
    array_to_string(fallos, ' | '), array_to_string(notas, ' | ');
end
$$;
