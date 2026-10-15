import "server-only";

/**
 * CONVERSACIONES DE WHATSAPP para el panel /admin
 * ───────────────────────────────────────────────
 * Lectura y cambios con la SESIÓN del panel. Row Level Security decide qué filas ve cada
 * uno: el administrador principal, todas; un asesor, solo las conversaciones asignadas a
 * él (0008). El panel solo puede cambiar el estado, el asesor asignado y quién tomó la
 * conversación (permisos de columna en 0006); un asesor no puede reasignarla a otro.
 */
import type {
  ConversationDetail,
  ConversationFilters,
  ConversationMessage,
  ConversationSummary,
  ConversationUpdate,
} from "@/types";
import { canAssignConversation } from "@/lib/staff";
import { requireAdmin } from "./auth";
import { getBackend } from "./env";
import { createSessionClient } from "./supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUMMARY_COLUMNS =
  "id, status, intent, escalation_reason, assigned_advisor_id, taken_by, taken_at, quote_request_id, last_message_at, created_at, lead_state, chat_contacts(display_name, external_id)";

interface Row {
  id: string;
  status: ConversationSummary["status"];
  intent: ConversationSummary["intent"];
  escalation_reason: ConversationSummary["escalationReason"];
  assigned_advisor_id: string | null;
  taken_by: string | null;
  taken_at: string | null;
  quote_request_id: string | null;
  last_message_at: string;
  created_at: string;
  lead_state: Record<string, unknown> | null;
  chat_contacts: { display_name: string | null; external_id: string } | null;
}

const toSummary = (r: Row): ConversationSummary => ({
  id: r.id,
  status: r.status,
  intent: r.intent,
  escalationReason: r.escalation_reason,
  contactName: r.chat_contacts?.display_name ?? null,
  contactNumber: r.chat_contacts?.external_id ?? "",
  assignedAdvisorId: r.assigned_advisor_id,
  takenBy: r.taken_by,
  takenAt: r.taken_at,
  quoteRequestId: r.quote_request_id,
  lastMessageAt: r.last_message_at,
  createdAt: r.created_at,
});

/** Las conversaciones solo existen con Supabase (en modo local de desarrollo no hay). */
const enabled = () => getBackend() === "supabase";

export async function listConversations(filters: ConversationFilters): Promise<ConversationSummary[]> {
  await requireAdmin();
  if (!enabled()) return [];
  const supabase = await createSessionClient();
  let query = supabase
    .from("chat_conversations")
    .select(SUMMARY_COLUMNS)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false })
    .limit(300);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase conversaciones: ${error.message}`);
  return (data as unknown as Row[]).map(toSummary);
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  await requireAdmin();
  if (!enabled() || !UUID.test(id)) return null;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("chat_conversations").select(SUMMARY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase conversación: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Row;

  const [messages, consents, request] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, direction, author, message_type, body, health_redacted, intent, delivery_status, is_simulated, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("chat_consents")
      .select("consent_type, granted, privacy_policy_version, terms_version, consent_text_version, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    row.quote_request_id
      ? supabase.from("quote_requests").select("reference").eq("id", row.quote_request_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (messages.error) throw new Error(`Supabase mensajes: ${messages.error.message}`);
  if (consents.error) throw new Error(`Supabase autorizaciones: ${consents.error.message}`);

  return {
    ...toSummary(row),
    leadState: row.lead_state ?? {},
    quoteReference: (request.data as { reference?: string } | null)?.reference ?? null,
    messages: (messages.data ?? []).map(
      (m): ConversationMessage => ({
        id: m.id,
        direction: m.direction,
        author: m.author,
        messageType: m.message_type,
        body: m.body,
        healthRedacted: m.health_redacted,
        intent: m.intent,
        deliveryStatus: m.delivery_status,
        isSimulated: m.is_simulated,
        createdAt: m.created_at,
      }),
    ),
    consents: (consents.data ?? []).map((c) => ({
      type: c.consent_type,
      granted: c.granted,
      policyVersion: c.privacy_policy_version,
      termsVersion: c.terms_version,
      textVersion: c.consent_text_version,
      createdAt: c.created_at,
    })),
  };
}

/** Cambia el estado/asignación. `take` registra al asesor de la sesión como responsable. */
export async function updateConversation(id: string, patch: ConversationUpdate): Promise<boolean> {
  const session = await requireAdmin();
  if (!enabled() || !UUID.test(id)) return false;
  // La base de datos también lo impide (RLS); aquí se rechaza antes de intentarlo.
  if (!canAssignConversation(session, patch.assignedAdvisorId)) return false;
  const supabase = await createSessionClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_conversations")
    .update({
      status: patch.status,
      assigned_advisor_id: patch.assignedAdvisorId,
      closed_at: patch.status === "cerrada" ? now : null,
      ...(patch.take ? { taken_by: session.email.slice(0, 120), taken_at: now } : {}),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    // Reabrir cuando el cliente ya tiene otra conversación abierta.
    if (error.code === "23505") throw new Error("El cliente ya tiene otra conversación abierta.");
    throw new Error(`Supabase actualizar conversación: ${error.message}`);
  }
  return Boolean(data);
}
