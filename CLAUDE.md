# D&J Virtual Seguros — contexto del proyecto

Sitio web de una agencia de seguros colombiana (D&J Virtual Seguros Limitada, Bogotá). Todo el contenido y la comunicación con el dueño son **en español**. Este archivo resume lo construido hasta el 6 de octubre de 2026 para que cualquier sesión nueva continúe sin perder contexto. Detalle técnico: `README.md`.

## Dónde está todo

| Qué | Dónde |
| --- | --- |
| Sitio oficial | https://dyjvirtualseguros.com (`www` redirige al dominio) |
| Hosting principal | Cloudflare Workers `dyj-virtual-seguros` (OpenNext). Respaldo: https://dyj-virtual-seguros.web-seguros.workers.dev |
| Hosting de respaldo | Vercel `dyj-virtual-seguros.vercel.app` (versión anterior, con `noindex`; no se actualiza) |
| Código | GitHub `dyjvirtualseguros20-prog/DYJVIRTUALSEGUROS`, rama `main` (sin despliegue automático) |
| Base de datos | Supabase, proyecto `dj-virtual-seguros` (id `tsrnkezdfpxjafmcawgq`, São Paulo). Otro proyecto vacío en la misma cuenta NO se usa |
| Dominio | Comprado en Cloudflare Registrar; Always Use HTTPS activo |
| Google Search Console | Dominio verificado (registro TXT en Cloudflare, no borrarlo) |

## Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind 4, Zod 4, Supabase (RLS + función `submit_quote_request` con la clave pública; no se usa clave secreta), Cloudflare Workers + Workers AI (binding `AI`, modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), rate limiting `CHAT_RATE_LIMITER`.

## Funcionalidades

- **Cotizador:** `/cotizar` y `/cotizar/{vehiculos,vida,hogar,salud,viajes,empresas}`, con sección informativa SEO bajo cada formulario. Las solicitudes se guardan en `quote_requests` (estado `nueva_solicitud`).
- **Panel `/admin`:** login con Supabase Auth, filtros, estados, notas, valor, fecha de contacto, WhatsApp al cliente, etiqueta «Asistente IA», autorizaciones del cliente. **Cuentas y roles (paso 2.4):** tabla `staff_users` — `admin_principal` (dyjvirtualseguros20@gmail.com: ve todo) y `asesor` (solo solicitudes con su `advisor_id` y conversaciones asignadas a él; lo impone RLS). Las cuentas se crean solo desde Supabase (SQL/service_role); nadie puede registrarse ni cambiar su rol desde la web. Para quitar acceso: `active = false` (no borrar). No puede quedar sin un `admin_principal` activo. `admin_users` se conserva sin uso.
- **Asesores:** tabla `advisors` (cristian, jeisson). Enlaces `/cristian`, `/jeisson` → cookie `asesor` (30 días, httpOnly) → la solicitud guarda `advisor_id` (lo asigna el servidor, nunca el navegador). Agregar asesor = fila nueva en `advisors`, sin código.
- **Contacto:** la empresa se identifica en toda la web solo como «D&J Virtual Seguros Limitada» (`siteConfig.name` = `legalName`); no se usa el nombre corto. Dos números oficiales de asesores, ninguno principal (`config/site.ts → advisorLines`): +57 310 289 2285 y +57 311 802 3725, con llamada y WhatsApp en Contacto, pie de página, menú del celular y documentos legales. El botón flotante usa el 311, o el del asesor si la visita llega por su enlace.
- **Asesor Virtual (IA):** botón encima del de WhatsApp. `server/assistant/` (prompt con solo información real de la web, `LeadState` con datos validados, recolección **agrupada** de datos faltantes, anclaje a lo que escribió el cliente, extracción de respaldo de correo/celular/cédula/placa/año/ciudad/nombre/tipo de vehículo por línea). Tarjeta de confirmación → `/api/quote-requests` con `source = asistente_ia`. Correo opcional solo para el asistente; cédula y ciudad obligatorias; en vehículos también uso y cobertura. No guarda conversaciones. Cupo gratis de Workers AI: 10.000 neuronas/día (~60 mensajes); se renueva a las 7:00 p. m. hora Colombia.
- **SEO:** títulos y descripciones por página, JSON-LD (InsuranceAgency sin dirección de calle, Service, Breadcrumb, FAQ), sitemap con fechas fijas, `noindex` en dominios que no son el oficial.
- **Legal:** `/politica-de-privacidad` (v2.3) y `/terminos-y-condiciones` (v1.3). Tres autorizaciones separadas (A política y términos, B uso para la cotización — obligatorias; C envío a aseguradoras — opcional) registradas por el servidor en `quote_requests.consent`. El servidor bloquea afirmaciones de pólizas aprobadas/emitidas, garantías, «la mejor aseguradora» y precios inventados, y no guarda datos de salud.
- **Aseguradoras (fase 2, sin conectar):** `server/insurers/` exige autorización C, envía solo los campos que cada aseguradora declara, valida respuestas; bitácora `insurer_transmissions`. La IA no puede disparar envíos.

- **WhatsApp (fase 1, simulación — rama `whatsapp-fase-1`, sin publicar la web):** núcleo común del Asesor IA en `server/assistant/core.ts` (web y WhatsApp usan el mismo cerebro; intenciones cotizacion, informacion, accidente, renovacion, reclamacion, asesor_humano, otro; escalamiento a persona). Worker `dyj-whatsapp` en `workers/whatsapp/` (solo `POST /simular` con clave; sin `/webhook`; no envía mensajes reales). Tablas `chat_contacts`, `chat_conversations`, `chat_messages`, `chat_consents`; rol `wa_bot`. Panel `/admin/whatsapp`. Pruebas: `cd workers/whatsapp && node scripts/run-tests.mjs`. Punto de restauración: tag `respaldo-2026-10-09-antes-whatsapp` y `C:\Users\pinzo\respaldos-dyj\*.bundle`.

## Migraciones Supabase aplicadas

`0001` solicitudes y admins · `0002` asesores · `0003` columna `source` · `0004` correo opcional solo para `asistente_ia` · `0005` `consent` + `insurer_transmissions` (copia previa en `supabase/backups/`) · `0006` conversaciones de WhatsApp + `source = 'whatsapp'` (solo el rol `wa_bot` puede usarlo) (copia previa en `supabase/backups/2026-10-09_antes_de_0006.sql`) · `0007` `chat_conversations.version` + trigger que la sube en cada cambio de estado (rollback en `supabase/backups/2026-10-09_antes_de_0007.sql`) · `0008` `staff_users`, roles y políticas de asesor; `private.is_admin()` = administrador principal activo (rollback en `supabase/backups/2026-10-11_antes_de_0008.sql`; pruebas en `supabase/tests/0008_permisos.sql`) · `0009` `audit_events` (solo inserción), `log_staff_action()`, `tool_policies`, `action_proposals`, `tool_idempotency` (rollback en `supabase/backups/2026-10-11_antes_de_0009.sql`; pruebas en `supabase/tests/0009_auditoria.sql`) · `0010` `advisors.central_base` (solo Cristian), `chat_contact_requests`, `wa_contact_requests()` (rollback en `supabase/backups/2026-10-11_antes_de_0010.sql`).

Fila por cliente (paso 2.3): Durable Object `ConversationQueue` en `dyj-whatsapp` (uno por número; orden, ráfagas de 2,5 s, reintentos). Verificación estándar: `npm run verificar-todo`.

Acciones y auditoría (paso 2.5): todo cambio de estado de la IA (WhatsApp) y del panel pasa por el ToolRunner (`server/tools/runner.ts`; herramientas en `server/tools/staff.ts` y `workers/whatsapp/src/tools.ts`): actor, política, entrada, autorización, idempotencia y un evento en `audit_events` sin datos personales. Niveles LEER/PROPONER/EJECUTAR/ESCALAR; la IA no ganó autonomía. Para apagar una acción sin desplegar: `update tool_policies set enabled = false` (o `requires_human = true` para que la IA solo proponga).

MVP del Súper Asesor (simulación): «¿qué pasó con mi cotización?» responde solo con datos de la base (`workers/whatsapp/src/followup.ts`); «muy caro / otra opción» queda como propuesta y pasa al asesor; WhatsApp solo asigna clientes a asesores con `central_base` (Jeisson no). `/simular` con `"modelo": "prueba"` usa el modelo de simulación (sin Workers AI) y `"asesor": "<id>"` simula la llegada desde el enlace de un asesor.

WhatsApp real (preparado): `GET/POST /webhook` en `dyj-whatsapp` con firma `X-Hub-Signature-256`, deduplicación por wamid en la fila, envío por Cloud API (`src/sender.ts`). Modos (`WHATSAPP_MODE`): `simulacion` · `piloto` (la IA solo atiende `WHATSAPP_PILOT_NUMBERS`; el resto se ignora y lo atiende la persona en su app) · `produccion`. Coexistencia: si Cristian responde desde la app WhatsApp Business (eco `smb_message_echoes`), la conversación pasa a «asesor» y la IA se calla. El 311 (Cristian) NO se migra: solo se conecta por coexistencia (exige que D&J sea Tech Provider de Meta). Secretos solo en Cloudflare: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PILOT_NUMBERS`.

## Cómo trabajar

- Local: `npm run dev` (puerto 3100 en la app). Workers AI real en local vía `initOpenNextCloudflareForDev` + `npx wrangler login` (consume el mismo cupo).
- Publicar en Cloudflare: detener el servidor local (bloquea `.open-next`), luego `npx opennextjs-cloudflare build` y `npx wrangler deploy`. **Solo con autorización del dueño.**
- Comprobaciones antes de publicar: `npx tsc --noEmit -p .`, `npx eslint .`, build de Next y de Cloudflare.
- Datos de prueba: usar nombres «Prueba …» y `prueba@example.com`; borrarlos siempre después. Nunca borrar solicitudes reales.

## Reglas del dueño (respetar siempre)

- No inventar datos de la empresa, aseguradoras, precios, coberturas ni información legal. Lo que falte va como **[POR COMPLETAR]**.
- No cambiar URLs públicas, diseño, el texto del botón «Ver mis opciones», ni romper `/cristian`, `/jeisson`, `/admin`, WhatsApp, formularios o Supabase.
- No pedir ni exponer contraseñas o claves secretas; los secretos van en Cloudflare Secrets.
- No borrar Vercel ni datos de Supabase. No publicar sin autorización.
- La dirección Carrera 53 # 176-63 es privada: solo aparece como domicilio legal en la política.

## Pendientes

- (Hecho) Datos legales: NIT 900788292-0 (dígito de verificación confirmado por el dueño con el RUT) y representantes legales Jeisson Steven Urrego Pérez y Deisy Yomaira Urrego Pérez.
- Revisión de un abogado colombiano: política, términos, RNBD, transferencias internacionales, obligaciones de agencia de seguros, autorización C, plazo de conservación, datos de salud.
- Probar el Asesor Virtual con la IA real en producción (tras renovarse el cupo).
- Opcional: plan Workers Paid (US$5/mes) si el tráfico del asistente supera el cupo gratis; Google Business Profile; foto de asesores; conectar APIs de las 5 aseguradoras cuando las entreguen.
