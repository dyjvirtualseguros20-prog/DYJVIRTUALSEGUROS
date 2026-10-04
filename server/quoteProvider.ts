import "server-only";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  🔌 AQUÍ SE CONECTARÁ LA API PROPIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Este módulo se ejecuta SOLO en el servidor (nunca llega al navegador),
 *  por eso es el lugar correcto para usar credenciales.
 *
 *  Arquitectura futura:
 *    Navegador ─► POST /api/quotes (app/api/quotes/route.ts)
 *              ─► requestQuotes() (este archivo)
 *              ─► TU API PROPIA (QUOTES_API_URL)
 *              ─► Base de datos + integraciones con aseguradoras
 *
 *  Cómo activarla:
 *    1. Define QUOTES_API_URL y QUOTES_API_KEY en .env.local (o en tu hosting).
 *    2. Ajusta la ruta y el formato de `callOwnApi()` al contrato de tu API.
 *    3. Pon NEXT_PUBLIC_QUOTES_SOURCE=api para que el navegador use esta ruta.
 *
 *  Mientras QUOTES_API_URL esté vacía se responde con datos MOCK
 *  (marcados con isDemo: true).
 */
import { mockCreateRequest, mockGenerateQuotes } from "@/lib/mock/mockQuotes";
import type { AnyQuoteForm } from "@/lib/validation/quoteSchemas";
import { toQuoteRequest } from "@/services/clients";
import type { InsuranceType, QuoteRequest, QuoteResponse } from "@/types";

const API_URL = process.env.QUOTES_API_URL?.replace(/\/+$/, "") ?? "";
const API_KEY = process.env.QUOTES_API_KEY ?? "";

export class ProviderError extends Error {}

export async function requestQuotes(type: InsuranceType, form: AnyQuoteForm): Promise<QuoteResponse> {
  const request = toQuoteRequest(type, form);

  if (!API_URL) {
    // ─── MOCK ─── La API propia aún no está configurada.
    const receipt = mockCreateRequest();
    return { receipt, result: mockGenerateQuotes(receipt.requestId, type, form) };
  }

  return callOwnApi(request);
}

/**
 * Llamada a la API propia.
 * ⚠️ La ruta "/quote-requests" es un EJEMPLO: cámbiala por la de tu API cuando exista.
 */
async function callOwnApi(request: QuoteRequest): Promise<QuoteResponse> {
  const response = await fetch(`${API_URL}/quote-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify(request),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new ProviderError(`La API propia respondió ${response.status}`);
  }
  // TODO: validar la respuesta con un esquema (zod) cuando se defina el contrato.
  return (await response.json()) as QuoteResponse;
}
