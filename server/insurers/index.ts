import "server-only";

/**
 * CONECTORES DE ASEGURADORAS (preparado para la fase 2 — aún SIN conectar)
 * ─────────────────────────────────────────────────────────────────────────
 * Flujo obligatorio:
 *   Cliente solicita cotización → se le explica el uso de sus datos → AUTORIZA (consent.insurer_transfer)
 *   → el sistema valida → se envían SOLO los campos que cada aseguradora necesita (minimización)
 *   → API de la aseguradora → se VALIDA la respuesta → el cliente recibe el resultado → el asesor puede intervenir.
 *
 * Reglas (no negociables):
 *  - Solo se ejecuta en el servidor ("server-only"). El navegador nunca conoce las credenciales.
 *  - Credenciales en Cloudflare Secrets (p. ej. INSURER_<NOMBRE>_API_KEY), nunca en el código ni en GitHub.
 *  - Sin autorización de transmisión, no se envía nada (InsurerConsentError).
 *  - El asesor virtual (IA) NO puede disparar envíos: `trigger` solo admite "asesor" o "cliente".
 *  - No se envían datos sensibles (salud) salvo autorización expresa y separada (`sensitiveConsent`).
 *  - Cada envío se registra en public.insurer_transmissions con los NOMBRES de los campos (no los valores).
 *
 * Para conectar una aseguradora:
 *   1. Crea server/insurers/<aseguradora>.ts que implemente InsurerConnector (declara fieldsByType).
 *   2. Agrégalo a CONNECTORS y define su secreto en Cloudflare (Workers → Configuración → Variables y secretos).
 *   3. Llama a requestInsurerQuotes() desde una acción del panel /admin o tras la confirmación del cliente.
 *   4. El registro en insurer_transmissions requiere una función de servidor con permisos (pendiente al conectar).
 */
import { z } from "zod";
import type { InsuranceType, QuoteRequestRecord } from "@/types";

/** Quién inicia el envío. La IA no está permitida a propósito. */
export type TransmissionTrigger = "asesor" | "cliente";

export interface InsurerConnector {
  /** Nombre de la aseguradora. */
  name: string;
  /** Campos que esta aseguradora necesita por tipo de seguro (solo se envían estos). */
  fieldsByType: Partial<Record<InsuranceType, readonly string[]>>;
  /** Campos sensibles que pide (p. ej. declaración de salud). Requieren autorización expresa. */
  sensitiveFields?: readonly string[];
  quote(payload: InsurerPayload): Promise<unknown>;
}

/** Datos que se envían a una aseguradora: solo los necesarios. */
export interface InsurerPayload {
  reference: string;
  insuranceType: InsuranceType;
  data: Record<string, unknown>;
}

/** Oferta normalizada. Se valida antes de mostrarla: no se aceptan precios ni datos inválidos. */
export const insurerOfferSchema = z.object({
  insurer: z.string().min(2),
  product: z.string().min(2),
  /** Prima en pesos colombianos, tal como la entrega la aseguradora (no se altera). */
  annualPremium: z.number().positive(),
  coverages: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  deductible: z.string().optional(),
  validUntil: z.string().optional(),
  /** Referencia de la cotización en la aseguradora. */
  insurerReference: z.string().optional(),
});
export type InsurerOffer = z.infer<typeof insurerOfferSchema>;

export class InsurerConsentError extends Error {}

/** Conectores activos. Vacío hasta recibir las APIs de las aseguradoras. */
const CONNECTORS: InsurerConnector[] = [];

/** Datos disponibles de la solicitud (contacto + form_data). */
function availableData(request: QuoteRequestRecord): Record<string, unknown> {
  return {
    fullName: request.fullName,
    identification: request.identification,
    phone: request.phone,
    email: request.email,
    city: request.city,
    ...request.formData,
  };
}

/**
 * Prepara lo que se enviaría a una aseguradora: verifica la autorización y deja SOLO los campos
 * que esa aseguradora declara necesitar. Devuelve también los nombres de los campos (para el registro).
 */
export function prepareInsurerPayload(
  request: QuoteRequestRecord,
  connector: InsurerConnector,
  { sensitiveConsent = false }: { sensitiveConsent?: boolean } = {},
): { payload: InsurerPayload; fieldsSent: string[] } {
  if (request.consent?.insurer_transfer !== true) {
    throw new InsurerConsentError(
      `La solicitud ${request.reference} no tiene autorización para compartir datos con aseguradoras.`,
    );
  }
  const wanted = connector.fieldsByType[request.insuranceType] ?? [];
  const sensitive = new Set(connector.sensitiveFields ?? []);
  if (!sensitiveConsent && wanted.some((f) => sensitive.has(f))) {
    throw new InsurerConsentError(`${connector.name} pide datos sensibles: se necesita autorización expresa.`);
  }
  const source = availableData(request);
  const data: Record<string, unknown> = {};
  for (const field of wanted) if (source[field] !== undefined && source[field] !== null) data[field] = source[field];
  return {
    payload: { reference: request.reference, insuranceType: request.insuranceType, data },
    fieldsSent: Object.keys(data),
  };
}

/** Pide cotizaciones a las aseguradoras conectadas. Solo con autorización y solo desde el servidor. */
export async function requestInsurerQuotes(
  request: QuoteRequestRecord,
  trigger: TransmissionTrigger,
): Promise<{ offers: InsurerOffer[]; errors: Array<{ insurer: string; error: string }> }> {
  if (trigger !== "asesor" && trigger !== "cliente") throw new Error("Origen de envío no permitido.");
  const connectors = CONNECTORS.filter((c) => c.fieldsByType[request.insuranceType]);
  const offers: InsurerOffer[] = [];
  const errors: Array<{ insurer: string; error: string }> = [];

  for (const connector of connectors) {
    try {
      const { payload } = prepareInsurerPayload(request, connector);
      const raw = await connector.quote(payload);
      // La respuesta se valida: lo que no cumple el formato no se muestra al cliente.
      const parsed = z.array(insurerOfferSchema).safeParse(Array.isArray(raw) ? raw : [raw]);
      if (parsed.success) offers.push(...parsed.data);
      else errors.push({ insurer: connector.name, error: "Respuesta con formato no válido." });
    } catch (error) {
      errors.push({ insurer: connector.name, error: error instanceof Error ? error.message : "Error desconocido." });
    }
  }
  return { offers, errors };
}
