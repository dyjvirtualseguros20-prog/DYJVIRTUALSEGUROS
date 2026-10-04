/**
 * ⚠️  SISTEMA MOCK — COTIZACIONES SIMULADAS ⚠️
 *
 * Genera cotizaciones FICTICIAS para poder probar el flujo completo de la página
 * mientras no existe la API propia. Los precios NO son reales ni representan
 * una oferta de ninguna aseguradora. Todas las respuestas llevan `isDemo: true`.
 *
 * Este archivo solo se usa desde:
 *   - services/quotes.ts        (cuando NEXT_PUBLIC_QUOTES_SOURCE=mock)
 *   - server/quoteProvider.ts   (cuando la API propia aún no está configurada)
 *
 * Para eliminar el MOCK basta con dejar de importar este archivo.
 */
import type { AnyQuoteForm } from "@/lib/validation/quoteSchemas";
import type { InsuranceType, Quote, QuoteRequestReceipt, QuoteResult } from "@/types";
import { MOCK_INSURERS } from "./mockInsurers";

/** Tiempo de espera simulado para mostrar el estado "buscando opciones". */
export const MOCK_DELAY_MS = 2200;

const PLANS = [
  { planName: "Plan Esencial", coverage: "Básica", factor: 1 },
  { planName: "Plan Plus", coverage: "Completa", factor: 1.135 },
  { planName: "Plan Total", coverage: "Completa", factor: 1.27 },
] as const;

const HIGHLIGHTS: Record<InsuranceType, string[][]> = {
  vehiculos: [
    ["Responsabilidad civil", "Asistencia en carretera"],
    ["Pérdida total y parcial", "Responsabilidad civil", "Vehículo de reemplazo"],
    ["Pérdida total y parcial", "Responsabilidad civil ampliada", "Conductor elegido"],
  ],
  vida: [
    ["Fallecimiento", "Pago a beneficiarios"],
    ["Fallecimiento", "Incapacidad total y permanente"],
    ["Fallecimiento", "Incapacidad", "Enfermedades graves"],
  ],
  hogar: [
    ["Incendio y terremoto", "Asistencia domiciliaria"],
    ["Incendio y terremoto", "Hurto", "Daños por agua"],
    ["Todo riesgo", "Contenidos", "Responsabilidad civil"],
  ],
  salud: [
    ["Consulta externa", "Urgencias"],
    ["Hospitalización", "Especialistas", "Urgencias"],
    ["Hospitalización", "Cirugías", "Red ampliada"],
  ],
  viajes: [
    ["Gastos médicos", "Asistencia 24/7"],
    ["Gastos médicos", "Equipaje", "Cancelación"],
    ["Gastos médicos ampliados", "Equipaje", "Cancelación", "Deportes"],
  ],
  empresas: [
    ["Responsabilidad civil", "Asesoría"],
    ["Daños materiales", "Responsabilidad civil"],
    ["Multirriesgo", "Responsabilidad civil", "Lucro cesante"],
  ],
};

/** Precio base simulado según el tipo de seguro y los datos del formulario. */
function basePrice(type: InsuranceType, form: AnyQuoteForm): number {
  switch (type) {
    case "vehiculos":
      return 1_850_000;
    case "vida": {
      const amount = "coverageAmount" in form ? form.coverageAmount : 100_000_000;
      return Math.max(380_000, amount * 0.0045);
    }
    case "hogar": {
      const value = "propertyValue" in form ? form.propertyValue : 300_000_000;
      return Math.max(320_000, value * 0.0016);
    }
    case "salud": {
      const people = "people" in form ? form.people : 1;
      return 2_400_000 * people;
    }
    case "viajes": {
      if ("departureDate" in form && "returnDate" in form) {
        const days = Math.round((Date.parse(form.returnDate) - Date.parse(form.departureDate)) / 86_400_000) + 1;
        return Math.max(60_000, 18_000 * days * form.travelers);
      }
      return 150_000;
    }
    case "empresas": {
      const employees = "employees" in form ? form.employees : 10;
      return 2_900_000 + employees * 45_000;
    }
  }
}

const PERIOD: Record<InsuranceType, Quote["period"]> = {
  vehiculos: "anual",
  vida: "anual",
  hogar: "anual",
  salud: "anual",
  viajes: "por viaje",
  empresas: "anual",
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mockId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

/** Registra (en memoria, sin guardar nada) una solicitud ficticia. */
export function mockCreateRequest(): QuoteRequestReceipt {
  return {
    requestId: mockId("DEMO"),
    status: "nueva_solicitud",
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
}

/** Genera cotizaciones simuladas para una solicitud. */
export function mockGenerateQuotes(requestId: string, type: InsuranceType, form: AnyQuoteForm): QuoteResult {
  const base = basePrice(type, form);
  const validUntil = new Date(Date.now() + 15 * 86_400_000).toISOString();

  const quotes: Quote[] = MOCK_INSURERS.filter((i) => i.products.includes(type)).map((insurer, idx) => {
    const plan = PLANS[idx % PLANS.length];
    return {
      id: `${requestId}-${insurer.id}`,
      requestId,
      insuranceType: type,
      insurer: { id: insurer.id, name: insurer.name },
      planName: plan.planName,
      coverage: plan.coverage,
      price: roundTo(base * plan.factor, base > 1_000_000 ? 50_000 : 1_000),
      currency: "COP",
      period: PERIOD[type],
      highlights: HIGHLIGHTS[type][idx % 3],
      validUntil,
      isDemo: true,
    };
  });

  return { requestId, quotes, isDemo: true, generatedAt: new Date().toISOString() };
}

/** Flujo MOCK completo: registra la solicitud y devuelve cotizaciones tras una espera. */
export async function mockQuoteFlow(type: InsuranceType, form: AnyQuoteForm) {
  await delay(MOCK_DELAY_MS);
  const receipt = mockCreateRequest();
  const result = mockGenerateQuotes(receipt.requestId, type, form);
  return { receipt, result };
}
