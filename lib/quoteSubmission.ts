/**
 * PREPARACIÓN DE UNA SOLICITUD (común a la web y a WhatsApp)
 * ───────────────────────────────────────────────────────────
 * Convierte un formulario ya validado en los datos que se registran con
 * public.submit_quote_request(). La usan server/quoteRequests.ts (web) y el
 * Worker de WhatsApp, para que ambos guarden las solicitudes exactamente igual.
 */
import type { AnyQuoteForm, AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
import { toQuoteRequest } from "@/services/clients";
import type { InsuranceType } from "@/types";

/** Referencia corta y legible: SOL-7K2M9Q (sin 0/O/1/I para evitar confusiones). */
export function newRequestReference(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 letras: 256 es múltiplo de 32 → distribución uniforme
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `SOL-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export interface QuoteSubmission {
  insuranceType: InsuranceType;
  fullName: string;
  identification: string | null;
  phone: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  formData: Record<string, unknown>;
}

/**
 * Datos de la solicitud a partir del formulario validado.
 * `notes`: observaciones del cliente (se guardan en form_data.observaciones).
 */
export function buildQuoteSubmission(
  type: InsuranceType,
  form: AnyQuoteForm | AssistantQuoteForm,
  notes?: string,
): QuoteSubmission {
  const { contact, details } = toQuoteRequest(type, form);
  const formData: Record<string, unknown> = notes ? { ...details, observaciones: notes } : details;
  const identification =
    "documentNumber" in details ? String(details.documentNumber) : "nit" in details ? String(details.nit) : null;
  const city = "city" in details ? String(details.city) : null;
  return {
    insuranceType: type,
    fullName: contact.fullName,
    identification,
    phone: contact.phone,
    // El formulario pide un único número "Teléfono / WhatsApp" (10 dígitos, Colombia).
    whatsapp: `57${contact.phone}`,
    // Solo el asesor virtual y WhatsApp pueden enviar sin correo (la base de datos lo exige al formulario).
    email: contact.email || null,
    city,
    formData,
  };
}
