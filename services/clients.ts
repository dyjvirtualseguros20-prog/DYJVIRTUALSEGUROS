/**
 * SERVICIO DE CLIENTES / SOLICITUDES
 * ───────────────────────────────────
 * - toQuoteRequest(): separa contacto y detalles (estructura estándar QuoteRequest).
 * - submitQuoteRequest(): envía el formulario al backend (POST /api/quote-requests),
 *   que lo guarda en Supabase con el estado "Nueva solicitud".
 */
import { validateQuoteForm, type AnyQuoteForm, type AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
import type { InsuranceType, QuoteRequest, QuoteRequestReceipt } from "@/types";
import { ServiceError } from "./config";

/** Separa los datos de contacto de los detalles específicos de cada seguro. */
export function toQuoteRequest(insuranceType: InsuranceType, form: AnyQuoteForm | AssistantQuoteForm): QuoteRequest {
  const { fullName, phone, email, dataConsent, ...details } = form;
  return {
    insuranceType,
    contact: { fullName, phone, email },
    details,
    dataConsent,
  };
}

/** Registra la solicitud de cotización del cliente y devuelve su referencia. */
export async function submitQuoteRequest(
  insuranceType: InsuranceType,
  form: Record<string, unknown>,
): Promise<QuoteRequestReceipt> {
  const validation = validateQuoteForm(insuranceType, form);
  if (!validation.success) {
    throw new ServiceError("Revisa los campos marcados.", validation.errors);
  }

  let response: Response;
  try {
    response = await fetch("/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Se envían los valores originales: el servidor vuelve a validarlos.
      body: JSON.stringify({ insuranceType, form }),
    });
  } catch {
    throw new ServiceError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
  }

  const payload = (await response.json().catch(() => null)) as {
    receipt?: QuoteRequestReceipt;
    error?: string;
    fieldErrors?: Record<string, string>;
  } | null;

  if (!response.ok || !payload?.receipt) {
    throw new ServiceError(
      payload?.error ?? "No pudimos registrar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.",
      payload?.fieldErrors,
    );
  }
  return payload.receipt;
}
