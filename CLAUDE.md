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
- **Panel `/admin`:** login con Supabase Auth (admin: dyjvirtualseguros20@gmail.com), filtros, estados, notas, valor, fecha de contacto, WhatsApp al cliente, etiqueta «Asistente IA», autorizaciones del cliente.
- **Asesores:** tabla `advisors` (cristian, jeisson). Enlaces `/cristian`, `/jeisson` → cookie `asesor` (30 días, httpOnly) → la solicitud guarda `advisor_id` (lo asigna el servidor, nunca el navegador). Agregar asesor = fila nueva en `advisors`, sin código.
- **Contacto:** la empresa se identifica en toda la web solo como «D&J Virtual Seguros Limitada» (`siteConfig.name` = `legalName`); no se usa el nombre corto. Dos números oficiales de asesores, ninguno principal (`config/site.ts → advisorLines`): +57 310 289 2285 y +57 311 802 3725, con llamada y WhatsApp en Contacto, pie de página, menú del celular y documentos legales. El botón flotante usa el 311, o el del asesor si la visita llega por su enlace.
- **Asesor Virtual (IA):** botón encima del de WhatsApp. `server/assistant/` (prompt con solo información real de la web, `LeadState` con datos validados, recolección **agrupada** de datos faltantes, anclaje a lo que escribió el cliente, extracción de respaldo de correo/celular/cédula/placa/año/ciudad/nombre/tipo de vehículo por línea). Tarjeta de confirmación → `/api/quote-requests` con `source = asistente_ia`. Correo opcional solo para el asistente; cédula y ciudad obligatorias; en vehículos también uso y cobertura. No guarda conversaciones. Cupo gratis de Workers AI: 10.000 neuronas/día (~60 mensajes); se renueva a las 7:00 p. m. hora Colombia.
- **SEO:** títulos y descripciones por página, JSON-LD (InsuranceAgency sin dirección de calle, Service, Breadcrumb, FAQ), sitemap con fechas fijas, `noindex` en dominios que no son el oficial.
- **Legal:** `/politica-de-privacidad` (v2.3) y `/terminos-y-condiciones` (v1.3). Tres autorizaciones separadas (A política y términos, B uso para la cotización — obligatorias; C envío a aseguradoras — opcional) registradas por el servidor en `quote_requests.consent`. El servidor bloquea afirmaciones de pólizas aprobadas/emitidas, garantías, «la mejor aseguradora» y precios inventados, y no guarda datos de salud.
- **Aseguradoras (fase 2, sin conectar):** `server/insurers/` exige autorización C, envía solo los campos que cada aseguradora declara, valida respuestas; bitácora `insurer_transmissions`. La IA no puede disparar envíos.

## Migraciones Supabase aplicadas

`0001` solicitudes y admins · `0002` asesores · `0003` columna `source` · `0004` correo opcional solo para `asistente_ia` · `0005` `consent` + `insurer_transmissions` (copia previa en `supabase/backups/`).

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

- Datos legales completos: NIT 900788292 (dígito de verificación pendiente: el dueño lo confirmará con el RUT; no calcularlo ni inventarlo) y representantes legales Jeisson Steven Urrego Pérez y Deisy Yomaira Urrego Pérez.
- Revisión de un abogado colombiano: política, términos, RNBD, transferencias internacionales, obligaciones de agencia de seguros, autorización C, plazo de conservación, datos de salud.
- Probar el Asesor Virtual con la IA real en producción (tras renovarse el cupo).
- Opcional: plan Workers Paid (US$5/mes) si el tráfico del asistente supera el cupo gratis; Google Business Profile; foto de asesores; conectar APIs de las 5 aseguradoras cuando las entreguen.
