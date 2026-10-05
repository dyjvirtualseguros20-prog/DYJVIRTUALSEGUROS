import "server-only";

/**
 * SERVICIO DE SOLICITUDES (servidor)
 * ───────────────────────────────────
 *   Formulario ─► POST /api/quote-requests ─► createQuoteRequest() ─► Supabase (tabla quote_requests)
 *   /admin     ─► listQuoteRequests() / getQuoteRequest() / updateQuoteRequest()
 *
 * Las funciones del panel exigen sesión de asesor (requireAdmin) y, con Supabase,
 * además leen con la sesión del usuario para que RLS proteja los datos.
 */
import { randomInt } from "node:crypto";
import { normalizeAdvisorId } from "@/lib/advisorLink";
import type { AnyQuoteForm, AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
import { toQuoteRequest } from "@/services/clients";
import type {
  InsuranceType,
  QuoteRequestFilters,
  QuoteRequestReceipt,
  QuoteRequestRecord,
  QuoteRequestUpdate,
  RequestSource,
} from "@/types";
import { requireAdmin } from "./auth";
import { getBackend } from "./env";
import { localStore } from "./stores/localStore";
import { supabaseStore } from "./stores/supabaseStore";
import { DuplicateReferenceError, type QuoteRequestStore } from "./stores/types";

export class StorageNotConfiguredError extends Error {}

function getStore(): QuoteRequestStore {
  const backend = getBackend();
  if (backend === "supabase") return supabaseStore;
  if (backend === "local") return localStore;
  throw new StorageNotConfiguredError("Supabase no está configurado.");
}

/** Referencia corta y legible: SOL-7K2M9Q (sin 0/O/1/I para evitar confusiones). */
function newReference(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return `SOL-${code}`;
}

/**
 * Registra una solicitud validada con el estado "Nueva solicitud".
 * `source`: "formulario" (cotizador) o "asistente_ia" (asesor virtual).
 * `notes`: observaciones opcionales del cliente (se guardan en form_data.observaciones).
 */
export async function createQuoteRequest(
  type: InsuranceType,
  form: AnyQuoteForm | AssistantQuoteForm,
  advisorId: string | null = null,
  { source = "formulario", notes }: { source?: RequestSource; notes?: string } = {},
): Promise<QuoteRequestReceipt> {
  const { contact, details } = toQuoteRequest(type, form);
  const formData: Record<string, unknown> = notes ? { ...details, observaciones: notes } : details;
  const identification =
    "documentNumber" in details ? String(details.documentNumber) : "nit" in details ? String(details.nit) : null;
  const city = "city" in details ? String(details.city) : null;

  const store = getStore();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await store.create({
        reference: newReference(),
        insuranceType: type,
        fullName: contact.fullName,
        identification,
        phone: contact.phone,
        // El formulario pide un único número "Teléfono / WhatsApp" (10 dígitos, Colombia).
        whatsapp: `57${contact.phone}`,
        // Solo el asesor virtual puede enviar sin correo (la base de datos lo exige al formulario).
        email: contact.email || null,
        city,
        formData,
        advisorId: normalizeAdvisorId(advisorId),
        source,
      });
      return { requestId: created.reference, status: created.status, createdAt: created.createdAt, isDemo: false };
    } catch (error) {
      if (!(error instanceof DuplicateReferenceError)) throw error;
    }
  }
  throw new Error("No fue posible generar una referencia única.");
}

export async function listQuoteRequests(filters: QuoteRequestFilters): Promise<QuoteRequestRecord[]> {
  await requireAdmin();
  return getStore().list(filters);
}

export async function getQuoteRequest(id: string): Promise<QuoteRequestRecord | null> {
  await requireAdmin();
  return getStore().get(id);
}

export async function updateQuoteRequest(id: string, patch: QuoteRequestUpdate): Promise<QuoteRequestRecord | null> {
  await requireAdmin();
  return getStore().update(id, patch);
}
