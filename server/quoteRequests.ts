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
import { normalizeAdvisorId } from "@/lib/advisorLink";
import type { ConsentRecord } from "@/lib/legal";
import { buildQuoteSubmission, newRequestReference } from "@/lib/quoteSubmission";
import type { AnyQuoteForm, AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
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

/**
 * Registra una solicitud validada con el estado "Nueva solicitud".
 * `source`: "formulario" (cotizador) o "asistente_ia" (asesor virtual).
 * `notes`: observaciones opcionales del cliente (se guardan en form_data.observaciones).
 */
export async function createQuoteRequest(
  type: InsuranceType,
  form: AnyQuoteForm | AssistantQuoteForm,
  advisorId: string | null = null,
  { source = "formulario", notes, consent }: { source?: RequestSource; notes?: string; consent?: ConsentRecord } = {},
): Promise<QuoteRequestReceipt> {
  const submission = buildQuoteSubmission(type, form, notes);

  const store = getStore();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await store.create({
        reference: newRequestReference(),
        ...submission,
        advisorId: normalizeAdvisorId(advisorId),
        source,
        consent: consent ?? null,
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
