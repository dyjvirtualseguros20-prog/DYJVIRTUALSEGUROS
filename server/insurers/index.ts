import "server-only";

/**
 * CONECTORES DE ASEGURADORAS (preparado para la fase 2 — aún sin conectar)
 * ─────────────────────────────────────────────────────────────────────────
 * Flujo previsto:
 *   Solicitud guardada (quote_requests, formulario o asistente_ia)
 *     └─► requestInsurerQuotes() ─► un conector por aseguradora (su API)
 *           └─► ofertas normalizadas ─► comparación ─► cliente elige ─► pago ─► emisión ─► póliza
 *
 * Cuando una aseguradora entregue su API:
 *   1. Crea server/insurers/<aseguradora>.ts que implemente InsurerConnector.
 *   2. Agrégalo a CONNECTORS. Sus credenciales van en variables secretas del servidor.
 *   3. Llama a requestInsurerQuotes() después de guardar la solicitud.
 * Hasta entonces no se cotiza automáticamente ni se muestran precios: un asesor cotiza a mano.
 */
import type { InsuranceType } from "@/types";

/** Datos de la solicitud tal como se guardan (contacto + form_data validado). */
export interface InsurerQuoteInput {
  reference: string;
  insuranceType: InsuranceType;
  contact: { fullName: string; phone: string; email: string; city: string | null; identification: string | null };
  details: Record<string, unknown>;
  notes?: string;
}

/** Oferta normalizada de una aseguradora (mismo formato para todas). */
export interface InsurerOffer {
  insurer: string;
  product: string;
  /** Prima en pesos colombianos. */
  annualPremium: number;
  coverages: string[];
  deductible?: string;
  validUntil?: string;
  /** Respuesta original de la aseguradora (para auditoría). */
  raw?: unknown;
}

export interface InsurerConnector {
  /** Nombre de la aseguradora. */
  name: string;
  /** Tipos de seguro que cotiza su API. */
  supports: readonly InsuranceType[];
  quote(input: InsurerQuoteInput): Promise<InsurerOffer[]>;
}

/** Conectores activos. Vacío hasta recibir las APIs de las aseguradoras. */
const CONNECTORS: InsurerConnector[] = [];

/** Pide cotizaciones a todas las aseguradoras conectadas que cubran el tipo de seguro. */
export async function requestInsurerQuotes(input: InsurerQuoteInput): Promise<InsurerOffer[]> {
  const connectors = CONNECTORS.filter((c) => c.supports.includes(input.insuranceType));
  const results = await Promise.allSettled(connectors.map((c) => c.quote(input)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
