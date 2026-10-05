# Plataforma web de seguros

Página web con cotizador en línea, preparada para conectarse más adelante con una API propia y con varias aseguradoras.

**Tecnología:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 y Zod (validación compartida entre el navegador y el servidor).

## Instalación y ejecución

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # opcional: ajusta las variables
npm run dev                  # http://localhost:3000
```

Producción:

```bash
npm run build
npm start
```

Revisiones de calidad: `npm run typecheck`, `npm run lint` y `npm run format`.

## Dónde cambiar cada cosa

| Qué                                        | Dónde                                                          |
| ------------------------------------------ | -------------------------------------------------------------- |
| Nombre, descripción y razón social         | `config/site.ts` → `name`, `legalName`, `description`          |
| Logo                                       | Archivo en `public/logo.png` + `config/site.ts` → `logo`       |
| Favicon                                    | `app/icon.png` y `app/apple-icon.png`                          |
| Colores                                    | `config/site.ts` → `colors`                                    |
| WhatsApp (+57 311 802 3725) y su mensaje   | `config/site.ts` → `whatsapp`                                  |
| Email, ciudad, teléfono adicional, horario | `config/site.ts` → `contact` (si están vacíos, no se muestran) |
| Redes sociales                             | `config/site.ts` → `social`                                    |
| Logos de aseguradoras                      | `config/site.ts` → `insurerLogos` (`show: false` por defecto)  |
| Textos (hero, nosotros, beneficios, FAQ)   | `config/content.ts`                                            |
| Productos y descripciones                  | `lib/insurance.ts`                                             |
| Campos de cada formulario                  | `lib/forms/quoteForms.ts`                                      |
| Reglas de validación                       | `lib/validation/quoteSchemas.ts`                               |

## Arquitectura

```
Navegador
  └─ components/quote/QuoteWizard.tsx
       └─ services/quotes.ts → getQuotes()          ← ÚNICO punto de acceso a datos
            ├─ (mock) lib/mock/mockQuotes.ts         ← datos simulados
            └─ (api)  POST /api/quotes               ← app/api/quotes/route.ts (servidor)
                        └─ server/quoteProvider.ts   ← 🔌 aquí se conecta TU API
                              └─ QUOTES_API_URL → Base de datos → Aseguradoras
```

- **Sistema MOCK:** `lib/mock/` (aseguradoras «A/B/C (demo)» y precios simulados). Todo lleva `isDemo: true` y la interfaz muestra el aviso «Datos demostrativos».
- **Origen de datos:** `NEXT_PUBLIC_QUOTES_SOURCE=mock` (por defecto) o `api`.
- **Conexión con la API real:** `server/quoteProvider.ts`. Define `QUOTES_API_URL` y `QUOTES_API_KEY` en `.env.local`, ajusta `callOwnApi()` a tu contrato y cambia `NEXT_PUBLIC_QUOTES_SOURCE=api`.
- **Seguridad:** las credenciales solo existen en el servidor (`server-only`). El servidor vuelve a validar todo. Los datos del formulario no se guardan en el navegador.
- **Panel /admin:** página reservada con los módulos y los estados previstos (`types/client.ts → REQUEST_STATUSES`). Antes de mostrar datos hay que agregar autenticación.

## Pendientes antes de publicar

- Revisar el texto de `app/politica-de-privacidad` (Ley 1581 de 2012).
- Configurar `NEXT_PUBLIC_SITE_URL` con el dominio definitivo (SEO y Open Graph).
- Completar email, ciudad y redes en `config/site.ts`.

## Solicitudes y panel del asesor (/admin)

Flujo: formulario → `services/clients.ts → submitQuoteRequest()` → `POST /api/quote-requests` → `server/quoteRequests.ts` → Supabase (`quote_requests`, estado `nueva_solicitud`).
El asesor entra a `/admin`, filtra, abre una solicitud, cambia estado, registra notas, valor y fecha de contacto, y escribe al cliente por WhatsApp.

### Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega todo `supabase/migrations/0001_quote_requests.sql` y pulsa **Run**.
3. Copia en `.env.local` la URL del proyecto y la **Publishable key** (ambas públicas). **No se necesita clave secreta.**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   (También se acepta el nombre antiguo `NEXT_PUBLIC_SUPABASE_ANON_KEY`.)
4. **Authentication → Sign In / Providers**: desactiva _Allow new users to sign up_.
5. Crea el asesor: **Authentication → Users → Add user → Create new user** (marca _Auto Confirm User_) y luego ejecuta `supabase/crear_administrador.sql` con su correo.
6. Comprueba todo: `npm run verificar-supabase`, y reinicia `npm run dev`.

Proyecto actual: `dj-virtual-seguros` (región São Paulo), asesor `dyjvirtualseguros20@gmail.com`.

### Modo desarrollo (sin Supabase)

Si las variables de Supabase están vacías y no es producción, las solicitudes se guardan en `.data/quote-requests.json` y `/admin` acepta `ADMIN_DEV_EMAIL` / `ADMIN_DEV_PASSWORD` de `.env.local`. En producción este modo nunca se activa.

### Seguridad

- `/admin` protegido en tres capas: `proxy.ts`, `requireAdmin()` en cada página y acción, y Row Level Security en la base de datos.
- El público no tiene ningún permiso sobre `quote_requests`. Las solicitudes se registran con la función `public.submit_quote_request()`, que solo inserta (estado fijo `nueva_solicitud`) y devuelve la referencia. Supabase la marca como "ejecutable por anon": es intencional.
- Los asesores solo pueden modificar `status`, `advisor_notes`, `quote_amount` y `contacted_at`; nadie puede borrar solicitudes desde la app.

## Asesores y enlaces personalizados

Cada asesor comparte su propio enlace a la misma web:

- `https://dyjvirtualseguros.com/cristian` (también funciona `/?asesor=cristian` en cualquier página)

Al entrar por el enlace, `proxy.ts` guarda el asesor en una cookie segura (`asesor`, httpOnly, 30 días) y la web muestra su nombre, foto y WhatsApp. Cada solicitud guarda `quote_requests.advisor_id`, asignado **por el servidor** (nunca por el formulario) y validado por la base de datos. Los asesores no pueden modificarlo desde `/admin`, donde aparece la columna y el filtro **Asesor**.

**Agregar un asesor (sin tocar el código ni volver a publicar):** Supabase → Table Editor → `advisors` → Insert row:

| Columna     | Ejemplo              | Nota                                                                              |
| ----------- | -------------------- | --------------------------------------------------------------------------------- |
| `id`        | `juan`               | Va en el enlace. Minúsculas, números y guiones.                                   |
| `name`      | `Juan Pérez`         |                                                                                   |
| `whatsapp`  | `573001234567`       | 57 + 10 dígitos, sin espacios ni `+`.                                             |
| `phone`     | _(vacío)_            | Opcional; si está vacío se usa el WhatsApp.                                       |
| `photo_url` | `https://…/juan.jpg` | Opcional (https). Sin foto se muestran las iniciales.                             |
| `active`    | `true`               | Para retirar a un asesor, ponlo en `false` (no lo borres: conserva su historial). |

El enlace funciona en menos de un minuto. Migración: `supabase/migrations/0002_advisors.sql`.

## Asesor virtual con IA (fase 1)

Botón flotante encima del de WhatsApp que abre un chat con un modelo de **Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).

```
ChatWidget ─► POST /api/chat ─► server/assistant (orquestador) ─► server/ai/workersAi.ts (env.AI)
   │            mensajes recientes + LeadState            │
   │                                                       └─ server/assistant/lead.ts: valida cada dato
   └─ tarjeta de confirmación ─► POST /api/quote-requests (source = "asistente_ia")
                                     └─ futuro: server/insurers (APIs de aseguradoras)
```

- **IA real, sin respuestas fijas.** El modelo responde en JSON: mensaje, intención, tipo de seguro y los datos del último mensaje. El servidor valida cada dato con las reglas de los formularios y guarda el progreso en `LeadState`, que viaja con cada mensaje (la IA "recuerda" sin reenviar toda la charla).
- Responde solo con la información de la web (`config/`, `lib/insurance.ts`, campos de `lib/forms/quoteForms.ts`). No da precios ni inventa condiciones.
- Con todos los datos válidos muestra un resumen; el cliente acepta la política y envía. Se guarda en `quote_requests` con `source = 'asistente_ia'` y el asesor del enlace (cookie).
- Accidente o "quiero hablar con una persona" → botón de WhatsApp del asesor del enlace (o el oficial).
- **No se guardan conversaciones.** Límites: 1.000 caracteres por mensaje, 30 mensajes por conversación, 20 por visitante cada 10 minutos (+10/min con `CHAT_RATE_LIMITER`).
- Cambiar de proveedor de IA: otra implementación de `LanguageModel` en `server/ai/`.

**Configuración:** ninguna clave. El binding `"ai": { "binding": "AI" }` está en `wrangler.jsonc`.

| Dónde                   | Cómo funciona                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Cloudflare (producción) | El binding existe al publicar.                                                                 |
| Local (`npm run dev`)   | `next.config.ts` conecta el binding con `npx wrangler login`. Usa el mismo cupo de Workers AI. |
| Vercel (respaldo)       | No hay Workers AI: el botón no aparece.                                                        |

Opcional: `WORKERS_AI_MODEL` para probar otro modelo. Costo: 10.000 neuronas diarias gratis (≈ 60 mensajes con el modelo por defecto); con Workers Paid, US$0,011 por 1.000 neuronas (≈ US$0,0016 por mensaje).
