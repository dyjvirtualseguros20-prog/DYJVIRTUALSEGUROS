/**
 * SEGUIMIENTO: "¿qué pasó con mi cotización?" y "está muy caro / quiero otra opción"
 * ─────────────────────────────────────────────────────────────────────────────────
 * LA IA REDACTA, LOS DATOS MANDAN: estas respuestas se arman SOLO con lo que hay en la base de
 * datos (referencia, tipo, estado y fecha de las solicitudes de ESTE contacto). Nunca precios,
 * aseguradoras, coberturas, pagos ni pólizas. Si no hay dato, se dice que todavía no lo hay.
 */
import { getProduct } from "@/lib/insurance";
import { REQUEST_STATUSES, isInsuranceType, isRequestStatus } from "@/types";
import type { ContactRequest } from "./store";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Pregunta por el estado de una solicitud o cotización ya hecha. */
const STATUS_QUESTION =
  /((que|q)\s+(paso|ha pasado|hubo)|como\s+(va|vamos|sigue)|en\s+que\s+(va|quedo|esta)|(cual|como)\s+es\s+el\s+estado|estado\s+de|novedad\w*|noticias?)\b.{0,40}\b(cotizacion|solicitud|seguro|poliza|tramite)|ya\s+(me\s+)?(cotizaron|tienen\s+(mi|la)\s+cotizacion|respondieron)|ya\s+hay\s+(respuesta|cotizacion)/;
export const asksQuoteStatus = (text: string) => STATUS_QUESTION.test(fold(text));

/** Pide otra opción, otro precio o un descuento (lo decide un asesor, nunca la IA). */
const ALTERNATIVE_REQUEST =
  /(muy|demasiado|bastante|super|re)\s+car[oa]|esta\s+car[oa]|(otra|otras)\s+opcion|mas\s+barat|descuento|rebaja|mejor\s+precio|precio\s+mas\s+bajo|algo\s+mas\s+economico/;
export const asksForAlternative = (text: string) => ALTERNATIVE_REQUEST.test(fold(text));

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

/** Qué significa cada estado para el cliente (sin afirmar nada que no esté en la base). */
const NEXT_STEP: Record<string, string> = {
  nueva_solicitud:
    "Todavía no tengo el resultado de las aseguradoras. Cuando tu asesor lo tenga, te escribirá por este chat.",
  en_revision: "Un asesor la está revisando. Todavía no tengo el resultado de las aseguradoras.",
  cotizando: "Tu asesor la está cotizando con las aseguradoras. Todavía no tengo el resultado.",
  cotizado:
    "Tu asesor ya tiene información de la cotización y te la compartirá por este chat. Yo no puedo darte precios ni coberturas.",
  contactado: "Un asesor ya se comunicó contigo sobre esta solicitud. Si tienes dudas, escríbeme y le aviso.",
  vendido: "En nuestro registro figura como vendida. Los detalles de tu póliza te los confirma tu asesor.",
  cancelado: "Esta solicitud está cerrada. Si quieres, podemos empezar una nueva cotización.",
};

function describe(r: ContactRequest): string {
  const product = isInsuranceType(r.insuranceType) ? getProduct(r.insuranceType).name.toLowerCase() : "seguro";
  const label = isRequestStatus(r.status) ? REQUEST_STATUSES[r.status] : r.status;
  return `Tu solicitud ${r.reference} (${product}), registrada el ${formatDate(r.createdAt)}, está en estado «${label}». ${
    NEXT_STEP[r.status] ?? "Tu asesor te informará cualquier novedad."
  }`;
}

/** Respuesta a "¿qué pasó con mi cotización?" con los datos reales del contacto. */
export function statusReply(requests: ContactRequest[], pendingConfirmation: boolean): string {
  if (!requests.length) {
    if (pendingConfirmation)
      return "Todavía no hemos registrado tu solicitud: falta tu confirmación. Si los datos están bien, responde ACEPTO.";
    return "Todavía no tengo una solicitud de cotización registrada desde este número. Si quieres, te ayudo a crearla ahora: ¿qué quieres asegurar?";
  }
  const [latest, ...older] = requests;
  const others = older.length
    ? `\n\nTambién tienes ${older.length === 1 ? "otra solicitud" : `${older.length} solicitudes más`}: ${older
        .slice(0, 3)
        .map((r) => `${r.reference} («${isRequestStatus(r.status) ? REQUEST_STATUSES[r.status] : r.status}»)`)
        .join(", ")}.`
    : "";
  return `${describe(latest)}${others}`;
}

export const ALTERNATIVE_REPLY =
  "Entiendo 👍 Le dejo tu petición a tu asesor para que revise otras opciones contigo. Yo no manejo precios ni descuentos: solo los confirma la aseguradora a través del asesor, que continuará por este chat.";
