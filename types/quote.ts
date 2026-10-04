import type { InsuranceType } from "./insurance";
import type { Insurer } from "./insurer";
import type { QuoteRequestReceipt } from "./client";

/** Una opción de cotización devuelta por una aseguradora. */
export interface Quote {
  id: string;
  requestId: string;
  insuranceType: InsuranceType;
  insurer: Pick<Insurer, "id" | "name" | "logo">;
  /** Nombre del plan, p. ej. "Plan Completo". */
  planName: string;
  /** Nivel de cobertura, p. ej. "Completa", "Básica". */
  coverage: string;
  /** Precio en la moneda indicada (valor entero, sin decimales). */
  price: number;
  currency: "COP";
  /** Periodicidad del precio. */
  period: "anual" | "mensual" | "por viaje";
  /** Puntos destacados del plan. */
  highlights: string[];
  /** Fecha hasta la que es válida la cotización (ISO). */
  validUntil?: string;
  /** true cuando es un dato simulado (MOCK). */
  isDemo: boolean;
}

/** Resultado completo de una búsqueda de cotizaciones. */
export interface QuoteResult {
  requestId: string;
  quotes: Quote[];
  /** true si TODAS las cotizaciones son de demostración. */
  isDemo: boolean;
  generatedAt: string;
}

/** Respuesta completa de getQuotes(): confirmación de la solicitud + cotizaciones. */
export interface QuoteResponse {
  receipt: QuoteRequestReceipt;
  result: QuoteResult;
}
