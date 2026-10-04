/**
 * SERVICIO DE COTIZACIONES
 * ─────────────────────────
 * Es el ÚNICO punto por el que la interfaz pide cotizaciones.
 * Los componentes nunca importan datos MOCK ni hacen fetch directamente.
 *
 *   Componente ─► getQuotes() ─► (mock)  lib/mock/mockQuotes.ts
 *                              └► (api)   POST /api/quotes ─► server/quoteProvider.ts ─► TU API
 */
import { validateQuoteForm } from "@/lib/validation/quoteSchemas";
import type { InsuranceType, QuoteResponse } from "@/types";
import { DATA_SOURCE, ServiceError } from "./config";

export interface GetQuotesInput {
  insuranceType: InsuranceType;
  /** Valores del formulario tal como los escribió el usuario. */
  form: Record<string, unknown>;
}

/**
 * Registra la solicitud de cotización y devuelve las opciones disponibles.
 * Hoy usa datos simulados; con NEXT_PUBLIC_QUOTES_SOURCE=api usa el backend.
 */
export async function getQuotes(input: GetQuotesInput): Promise<QuoteResponse> {
  const validation = validateQuoteForm(input.insuranceType, input.form);
  if (!validation.success) {
    throw new ServiceError("Revisa los campos marcados.", validation.errors);
  }

  if (DATA_SOURCE === "mock") {
    // ─── MOCK ─── Datos simulados, sin red. Import dinámico: el MOCK no se
    // descarga en el navegador cuando se usa la API.
    const { mockQuoteFlow } = await import("@/lib/mock/mockQuotes");
    return mockQuoteFlow(input.insuranceType, validation.data);
  }

  // ─── API ─── Llamada al backend de esta misma app (app/api/quotes/route.ts).
  // Se envían los valores originales: el servidor vuelve a validarlos.
  let response: Response;
  try {
    response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insuranceType: input.insuranceType, form: input.form }),
    });
  } catch {
    throw new ServiceError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
  }

  const payload = (await response.json().catch(() => null)) as
    (QuoteResponse & { error?: string; fieldErrors?: Record<string, string> }) | null;

  if (!response.ok || !payload) {
    throw new ServiceError(
      payload?.error ?? "No fue posible obtener cotizaciones en este momento.",
      payload?.fieldErrors,
    );
  }
  return payload;
}
