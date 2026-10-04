/**
 * Enlaces personalizados de asesor: https://sitio/cristian  (o  https://sitio/?asesor=cristian)
 * Constantes compartidas por proxy.ts (que guarda la cookie) y el servidor (que la lee).
 */

/** Cookie donde se conserva el asesor durante la navegación. */
export const ADVISOR_COOKIE = "asesor";

/** Días que dura la atribución desde la última visita con enlace de asesor. */
export const ADVISOR_COOKIE_DAYS = 30;

/** Parámetro alternativo en la URL: /?asesor=cristian */
export const ADVISOR_QUERY_PARAM = "asesor";

/** Mismo formato que la restricción de public.advisors.id. */
const ADVISOR_ID = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

/** Rutas del sitio que nunca son un asesor (también están bloqueadas en la base de datos). */
const RESERVED = new Set([
  "admin",
  "api",
  "cotizar",
  "politica-de-privacidad",
  "asesor",
  "asesores",
  "robots",
  "sitemap",
  "manifest",
  "icon",
  "apple-icon",
  "opengraph-image",
  "logo",
  "aseguradoras",
  "inicio",
  "contacto",
  "seguros",
  "nosotros",
]);

/** Normaliza y valida un posible identificador de asesor. Devuelve null si no es válido. */
export function normalizeAdvisorId(value: string | null | undefined): string | null {
  const id = (value ?? "").trim().toLowerCase();
  return ADVISOR_ID.test(id) && !RESERVED.has(id) ? id : null;
}
