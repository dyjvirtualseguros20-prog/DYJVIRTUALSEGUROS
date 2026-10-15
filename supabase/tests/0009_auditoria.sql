-- ═══════════════════════════════════════════════════════════════════════════
--  PRUEBAS DE AUDITORÍA Y CAPA DE ACCIONES (paso 2.5)
--
--  Se ejecuta COMPLETO como una sola consulta (igual que 0008_permisos.sql): crea datos
--  de prueba, actúa como cada rol y al final LANZA UN ERROR A PROPÓSITO con el resultado,
--  así todo se deshace (incluidos los eventos de auditoría de prueba).
--
--    Resultado esperado:  ERROR:  RESULTADO_AUDITORIA ok=46 fallos=0
--
--  Para actuar como wa_bot, la sesión se otorga ese rol DENTRO de la transacción (también se
--  deshace). No toca datos reales ni a los asesores reales.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_owner uuid := (select user_id from public.staff_users where role = 'admin_principal' and active order by created_at limit 1);
  ua uuid := gen_random_uuid(); -- asesor A
  ui uuid := gen_random_uuid(); -- asesor inactivo
  ux uuid := gen_random_uuid(); -- registrado sin cuenta de staff
  v_yo text := current_user;
  v_ev uuid; v_prop uuid;
  n int; t text; ok int := 0; fallos text[] := '{}'; notas text[] := '{}';
  v_wa boolean := false;
  antes jsonb := jsonb_build_object(
    'qr', (select count(*) from public.quote_requests), 'conv', (select count(*) from public.chat_conversations),
    'msg', (select count(*) from public.chat_messages), 'staff', (select count(*) from public.staff_users),
    'adv', (select count(*) from public.advisors));
begin
  if v_owner is null then raise exception 'No hay admin_principal activo'; end if;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba-asesor-a@example.com', 'authenticated', 'authenticated'),
    (ui, 'prueba-asesor-c@example.com', 'authenticated', 'authenticated'),
    (ux, 'prueba-registro@example.com', 'authenticated', 'authenticated');
  insert into public.advisors (id, name, whatsapp, active) values
    ('prueba-a', 'Prueba Asesor A', '573000000001', false), ('prueba-c', 'Prueba Asesor C', '573000000003', false);
  insert into public.staff_users (user_id, role, advisor_id, active) values
    (ua, 'asesor', 'prueba-a', true), (ui, 'asesor', 'prueba-c', false);

  -- ═══ 1. ADMINISTRADOR PRINCIPAL ════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_ev := public.log_staff_action('solicitud.actualizar_gestion', 'ejecutar', 'quote_request', 'prueba-1', 'exito',
                                  null, null, null, '{"status":"cotizando"}'::jsonb);
  select count(*) into n from public.audit_events
    where id = v_ev and actor_type = 'admin' and actor_user_id = v_owner and actor_id = v_owner::text and channel = 'admin';
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'D1 el evento del admin no quedó con su identidad'; end if;
  v_ev := public.log_staff_action('solicitud.actualizar_gestion', 'ejecutar', 'quote_request', 'prueba-2', 'error',
                                  'fallo', 'Base de datos no disponible', null, '{}'::jsonb);
  select count(*) into n from public.audit_events where id = v_ev and outcome = 'error' and error_message is not null;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'D2 no se registró el error'; end if;
  begin
    update public.audit_events set outcome = 'exito' where id = v_ev;
    fallos := fallos || text 'D3 el admin modificó un evento';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    delete from public.audit_events where id = v_ev;
    fallos := fallos || text 'D4 el admin borró un evento';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    insert into public.audit_events (actor_type, actor_id, actor_user_id, channel, action, level, outcome)
      values ('admin', 'falso', v_owner, 'admin', 'prueba.directa', 'ejecutar', 'exito');
    fallos := fallos || text 'D5 se insertó auditoría sin pasar por log_staff_action';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform public.log_staff_action('accion invalida', 'ejecutar', null, null, 'exito');
    fallos := fallos || text 'D6 aceptó un nombre de acción inválido';
  exception when check_violation then ok := ok + 1; end;
  begin
    perform public.log_staff_action('prueba.grande', 'ejecutar', null, null, 'exito', null, null, null,
      jsonb_build_object('x', repeat('a', 5000)));
    fallos := fallos || text 'D7 aceptó metadatos demasiado grandes';
  exception when check_violation then ok := ok + 1; end;
  select count(*) into n from public.tool_policies;
  if n >= 6 then ok := ok + 1; else fallos := fallos || text 'D8 el admin no lee tool_policies'; end if;
  begin
    update public.tool_policies set enabled = false where action = 'solicitud.registrar';
    fallos := fallos || text 'D9 se modificó tool_policies desde la API';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform 1 from public.tool_idempotency limit 1;
    fallos := fallos || text 'D10 la sesión lee tool_idempotency';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- Propuesta (creada como postgres = el Worker) y decisión del admin.
  perform set_config('role', v_yo, true);
  insert into public.action_proposals (action, proposed_by_type, proposed_by_id, channel, resource_type, resource_id, idempotency_key)
    values ('conversacion.asignar_asesor', 'ia', 'asesor-virtual', 'whatsapp', 'chat_conversation', 'prueba', 'prueba-propuesta-1')
    returning id into v_prop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.action_proposals set status = 'aprobada', decided_by = ua, decided_at = now() where id = v_prop;
    fallos := fallos || text 'D11 el admin firmó la decisión como otro usuario';
  exception when insufficient_privilege then ok := ok + 1; end;
  update public.action_proposals set status = 'aprobada', decided_by = v_owner, decided_at = now() where id = v_prop;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'D12 el admin no pudo decidir la propuesta'; end if;
  update public.action_proposals set status = 'rechazada', decided_by = v_owner where id = v_prop;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'D13 se cambió una propuesta ya decidida'; end if;
  begin
    update public.action_proposals set action = 'otra.accion' where id = v_prop;
    fallos := fallos || text 'D14 se cambió la acción de una propuesta';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- ═══ 2. ASESOR ═════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_ev := public.log_staff_action('conversacion.gestionar', 'ejecutar', 'chat_conversation', 'ajena', 'denegado', 'sin_acceso');
  perform set_config('role', v_yo, true);
  select count(*) into n from public.audit_events
    where id = v_ev and actor_type = 'asesor' and actor_user_id = ua and outcome = 'denegado' and reason = 'sin_acceso';
  if n = 1 then ok := ok + 1; else fallos := fallos || text 'S1 el intento denegado del asesor no quedó con su identidad'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.audit_events;
  if n = 0 then ok := ok + 1; else fallos := fallos || format('S2 el asesor lee %s eventos de auditoría', n); end if;
  begin
    insert into public.audit_events (actor_type, actor_id, actor_user_id, channel, action, level, outcome)
      values ('admin', v_owner::text, v_owner, 'admin', 'prueba.suplantar', 'ejecutar', 'exito');
    fallos := fallos || text 'S3 el asesor insertó un evento como admin';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    update public.audit_events set reason = 'x' where id = v_ev;
    fallos := fallos || text 'S4 el asesor modificó auditoría';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    delete from public.audit_events where id = v_ev;
    fallos := fallos || text 'S5 el asesor borró auditoría';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.action_proposals;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'S6 el asesor ve propuestas'; end if;
  update public.action_proposals set status = 'cancelada', decided_by = ua, decided_at = now() where id = v_prop;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'S7 el asesor decidió una propuesta'; end if;
  begin
    insert into public.tool_idempotency (key, action, status) values ('prueba', 'prueba.x', 'completado');
    fallos := fallos || text 'S8 el asesor escribió en tool_idempotency';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.tool_policies;
  if n >= 6 then ok := ok + 1; else fallos := fallos || text 'S9 el asesor no lee las políticas'; end if;

  -- ═══ 3. INACTIVO, REGISTRADO SIN CUENTA Y ANÓNIMO ══════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', ui, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.log_staff_action('conversacion.gestionar', 'ejecutar', null, null, 'exito');
    fallos := fallos || text 'I1 un asesor inactivo registró una acción';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.tool_policies;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'I2 un inactivo lee las políticas'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ux, 'role', 'authenticated')::text, true);
  begin
    perform public.log_staff_action('conversacion.gestionar', 'ejecutar', null, null, 'exito');
    fallos := fallos || text 'X1 un usuario sin cuenta registró una acción';
  exception when insufficient_privilege then ok := ok + 1; end;
  select count(*) into n from public.audit_events;
  if n = 0 then ok := ok + 1; else fallos := fallos || text 'X2 un usuario sin cuenta lee auditoría'; end if;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform public.log_staff_action('conversacion.gestionar', 'ejecutar', null, null, 'exito');
    fallos := fallos || text 'N1 anon ejecutó log_staff_action';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform 1 from public.audit_events limit 1;
    fallos := fallos || text 'N2 anon lee auditoría';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    perform 1 from public.action_proposals limit 1;
    fallos := fallos || text 'N3 anon lee propuestas';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- ═══ 4. NADIE MODIFICA LA AUDITORÍA (ni el dueño de la tabla) ══════════════
  perform set_config('role', v_yo, true);
  begin
    update public.audit_events set outcome = 'exito' where id = v_ev;
    fallos := fallos || text 'P1 el dueño de la tabla modificó un evento';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    delete from public.audit_events where id = v_ev;
    fallos := fallos || text 'P2 el dueño de la tabla borró un evento';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin
    truncate public.audit_events;
    fallos := fallos || text 'P3 se vació la auditoría';
  exception when insufficient_privilege then ok := ok + 1; end;
  if has_table_privilege('service_role', 'public.audit_events', 'INSERT')
     and not has_table_privilege('service_role', 'public.audit_events', 'UPDATE')
     and not has_table_privilege('service_role', 'public.audit_events', 'DELETE')
     and not has_table_privilege('service_role', 'public.audit_events', 'TRUNCATE')
  then ok := ok + 1; else fallos := fallos || text 'P4 service_role puede modificar la auditoría'; end if;

  -- ═══ 5. wa_bot: mínimo privilegio ══════════════════════════════════════════
  if has_table_privilege('wa_bot', 'public.audit_events', 'INSERT')
     and not has_table_privilege('wa_bot', 'public.audit_events', 'SELECT')
     and not has_table_privilege('wa_bot', 'public.audit_events', 'UPDATE')
     and not has_table_privilege('wa_bot', 'public.audit_events', 'DELETE')
     and not has_table_privilege('wa_bot', 'public.staff_users', 'SELECT')
     and not has_table_privilege('wa_bot', 'public.quote_requests', 'SELECT')
     and not has_table_privilege('wa_bot', 'public.action_proposals', 'SELECT')
     and not has_table_privilege('wa_bot', 'public.action_proposals', 'UPDATE')
     and not has_table_privilege('wa_bot', 'public.tool_policies', 'UPDATE')
     and not has_function_privilege('wa_bot', 'public.log_staff_action(text, text, text, text, text, text, text, text, jsonb)', 'EXECUTE')
  then ok := ok + 1; else fallos := fallos || text 'W1 permisos de wa_bot más amplios de lo previsto'; end if;

  begin
    execute format('grant wa_bot to %I', v_yo);
    perform set_config('role', 'wa_bot', true);
    v_wa := true;
  exception when others then v_wa := false; end;
  if v_wa then
    perform set_config('role', 'wa_bot', true);
    insert into public.audit_events (actor_type, actor_id, channel, action, level, resource_type, resource_id, outcome)
      values ('ia', 'asesor-virtual', 'whatsapp', 'conversacion.escalar', 'escalar', 'chat_conversation', 'prueba', 'exito');
    ok := ok + 1;
    begin
      insert into public.audit_events (actor_type, actor_id, actor_user_id, channel, action, level, outcome)
        values ('admin', v_owner::text, v_owner, 'admin', 'prueba.suplantar', 'ejecutar', 'exito');
      fallos := fallos || text 'W3 wa_bot firmó un evento como admin';
    exception when insufficient_privilege then ok := ok + 1; end;
    begin
      perform 1 from public.audit_events limit 1;
      fallos := fallos || text 'W4 wa_bot lee auditoría';
    exception when insufficient_privilege then ok := ok + 1; end;
    select count(*) into n from public.tool_policies where action = 'solicitud.registrar' and enabled;
    if n = 1 then ok := ok + 1; else fallos := fallos || text 'W5 wa_bot no lee la política'; end if;
    insert into public.action_proposals (action, proposed_by_type, proposed_by_id, channel, idempotency_key)
      values ('conversacion.asignar_asesor', 'ia', 'asesor-virtual', 'whatsapp', 'prueba-propuesta-2')
      on conflict do nothing;
    insert into public.action_proposals (action, proposed_by_type, proposed_by_id, channel, idempotency_key)
      values ('conversacion.asignar_asesor', 'ia', 'asesor-virtual', 'whatsapp', 'prueba-propuesta-2')
      on conflict do nothing;
    ok := ok + 1;
    begin
      insert into public.action_proposals (action, proposed_by_type, proposed_by_id, channel, status)
        values ('conversacion.asignar_asesor', 'ia', 'asesor-virtual', 'whatsapp', 'aprobada');
      fallos := fallos || text 'W7 wa_bot creó una propuesta ya aprobada';
    exception when insufficient_privilege or check_violation then ok := ok + 1; end;
    -- Idempotencia: primera reserva, duplicado, liberación tras fallo y nueva reserva.
    insert into public.tool_idempotency (key, action, status) values ('prueba-clave', 'solicitud.registrar', 'en_curso')
      on conflict (key) do update set status = 'en_curso' where public.tool_idempotency.status = 'fallido'
      returning status into t;
    if t = 'en_curso' then ok := ok + 1; else fallos := fallos || text 'W8 no se reservó la clave'; end if;
    t := null;
    insert into public.tool_idempotency (key, action, status) values ('prueba-clave', 'solicitud.registrar', 'en_curso')
      on conflict (key) do update set status = 'en_curso' where public.tool_idempotency.status = 'fallido'
      returning status into t;
    if t is null then ok := ok + 1; else fallos := fallos || text 'W9 una clave en curso se reservó dos veces'; end if;
    update public.tool_idempotency set status = 'fallido' where key = 'prueba-clave';
    t := null;
    insert into public.tool_idempotency (key, action, status) values ('prueba-clave', 'solicitud.registrar', 'en_curso')
      on conflict (key) do update set status = 'en_curso' where public.tool_idempotency.status = 'fallido'
      returning status into t;
    if t = 'en_curso' then ok := ok + 1; else fallos := fallos || text 'W10 una clave fallida no se pudo reintentar'; end if;
    begin
      update public.audit_events set outcome = 'error';
      fallos := fallos || text 'W11 wa_bot modificó auditoría';
    exception when insufficient_privilege then ok := ok + 1; end;
    perform set_config('role', v_yo, true);
  else
    notas := notas || text 'W2-W11 omitidas: no se pudo asumir wa_bot';
  end if;

  -- ═══ 6. Datos existentes sin cambios ═══════════════════════════════════════
  perform set_config('role', v_yo, true);
  delete from public.staff_users where user_id in (ua, ui);
  delete from public.advisors where id in ('prueba-a', 'prueba-c');
  if jsonb_build_object(
    'qr', (select count(*) from public.quote_requests), 'conv', (select count(*) from public.chat_conversations),
    'msg', (select count(*) from public.chat_messages), 'staff', (select count(*) from public.staff_users),
    'adv', (select count(*) from public.advisors)) = antes
  then ok := ok + 1; else fallos := fallos || text 'E1 cambiaron datos existentes'; end if;

  raise exception 'RESULTADO_AUDITORIA ok=% fallos=% % || notas: %', ok, coalesce(array_length(fallos, 1), 0),
    array_to_string(fallos, ' | '), array_to_string(notas, ' | ');
end
$$;
