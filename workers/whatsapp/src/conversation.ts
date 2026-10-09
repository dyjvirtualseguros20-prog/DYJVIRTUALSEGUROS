/**
 * CANAL WHATSAPP sobre el núcleo común del Asesor IA D&J
 * ──────────────────────────────────────────────────────
 *   mensaje entrante
 *     ├─ duplicado (mismo ID)                 → se ignora
 *     ├─ datos de salud                        → se ocultan ANTES de guardar el mensaje
 *     ├─ conversación con un asesor            → se guarda y la IA NO responde
 *     ├─ esperando confirmación de solicitud   → "ACEPTO" registra autorizaciones + solicitud
 *     └─ resto → núcleo (server/assistant/core.ts), con lo que ya se sabe (lead_state)
 *           ├─ escalar  → estado esperando_asesor (la IA deja de responder)
 *           ├─ borrador → resumen + autorizaciones, estado de confirmación
 *           └─ responder / pedir solo lo que falta
 */
import { cleanText, EMPTY_LEAD, type LeadState, type QuoteDraft } from "@/lib/chat";
import { LEGAL_VERSIONS, CONSENT_TEXT, QUOTE_DISCLAIMER } from "@/lib/legal";
import { buildQuoteSubmission, newRequestReference } from "@/lib/quoteSubmission";
import { validateAssistantForm, type AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
import type { LanguageModel } from "@/server/ai/model";
import { HISTORY_WINDOW, runAssistantTurn, type EscalationReason, type Intent } from "@/server/assistant/core";
import { redactHealthData } from "@/server/assistant/grounding";
import { leadNotes } from "@/server/assistant/lead";
import { type ChatStore, type Conversation, type ConversationStatus, DuplicateReferenceError } from "./store";
import type { OutboundSender } from "./sender";

/**
 * Versión del mensaje de autorización que se muestra por WhatsApp. Reutiliza los textos vigentes
 * de las casillas de la web (lib/legal.ts); el texto jurídico definitivo para WhatsApp está
 * PENDIENTE de revisión y, cuando exista, se cambia aquí junto con esta versión.
 */
export const WHATSAPP_CONSENT_TEXT_VERSION = "wa-tecnico-1-pendiente-revision-juridica";

/** Mensajes por conversación en 10 minutos a partir de los cuales la IA deja de responder. */
const MAX_INBOUND_PER_10_MIN = 20;

export interface Incoming {
  /** Número del cliente, solo dígitos con indicativo (p. ej. 573001234567). */
  from: string;
  name?: string | null;
  text: string;
  /** ID único del mensaje (wamid en Meta; "sim-…" en simulación). */
  messageId: string;
  simulated: boolean;
}

export interface Outcome {
  duplicate: boolean;
  conversationId: string | null;
  status: ConversationStatus | null;
  intent: Intent | null;
  escalation: EscalationReason | null;
  replies: string[];
  known: string[];
  missing: string[];
  healthRedacted: boolean;
  quoteReference: string | null;
}

export interface Deps {
  store: ChatStore;
  model: LanguageModel;
  sender: OutboundSender;
  defaultAdvisorId: string | null;
  siteUrl: string;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** "ACEPTO" (con o sin "sí") confirma los datos y da las autorizaciones A y B. */
const isAcceptance = (text: string) => /^\s*(si\s*,?\s*)?acepto\b/.test(fold(text));

/** Número de WhatsApp colombiano → celular de 10 dígitos (así no se vuelve a preguntar). */
const colombianMobile = (waId: string) => (/^573\d{9}$/.test(waId) ? waId.slice(2) : null);

export function initialLead(waId: string): LeadState {
  const phone = colombianMobile(waId);
  return { ...EMPTY_LEAD, fields: phone ? { phone } : {} };
}

function summaryMessage(draft: QuoteDraft): string {
  return `Revisa tu solicitud:\n${draft.summary.map((s) => `• ${s.label}: ${s.value}`).join("\n")}`;
}

function consentMessage(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return [
    "Para registrar tu solicitud necesito tu autorización:",
    `A. ${CONSENT_TEXT.privacyAccepted.before} ${CONSENT_TEXT.privacyAccepted.policy} (${base}/politica-de-privacidad) ${CONSENT_TEXT.privacyAccepted.middle} ${CONSENT_TEXT.privacyAccepted.terms} (${base}/terminos-y-condiciones)${CONSENT_TEXT.privacyAccepted.after}`,
    `B. ${CONSENT_TEXT.dataConsent.text}`,
    "Si los datos están bien y autorizas A y B, responde ACEPTO. Si quieres cambiar algo, escríbeme qué cambiar.",
  ].join("\n\n");
}

export async function handleIncoming(deps: Deps, msg: Incoming): Promise<Outcome> {
  const { store, sender } = deps;
  const from = msg.from.replace(/\D/g, "");
  if (!/^[0-9]{8,15}$/.test(from)) throw new Error("Número de WhatsApp no válido.");
  const original = cleanText(msg.text).slice(0, 4000);
  if (!original) throw new Error("Mensaje vacío.");

  const contact = await store.upsertContact(from, msg.name?.trim().slice(0, 120) || null);
  // Asesor de la conversación: el del contacto, o el predeterminado si está activo (si no, sin asesor).
  let advisorId = contact.advisorId;
  if (!advisorId && deps.defaultAdvisorId && (await store.isActiveAdvisor(deps.defaultAdvisorId)))
    advisorId = deps.defaultAdvisorId;
  const conversation = await store.openConversation(contact, advisorId, initialLead(from));

  // Datos de salud: se ocultan antes de guardar, conservando el resto del mensaje.
  const redacted = redactHealthData(original);
  const inbound = await store.insertMessage({
    conversationId: conversation.id,
    direction: "entrante",
    author: "cliente",
    body: redacted.text,
    healthRedacted: redacted.removed,
    externalId: msg.messageId,
    deliveryStatus: "recibido",
    isSimulated: msg.simulated,
  });

  const result: Outcome = {
    duplicate: false,
    conversationId: conversation.id,
    status: conversation.status,
    intent: conversation.intent,
    escalation: conversation.escalationReason,
    replies: [],
    known: [],
    missing: [],
    healthRedacted: redacted.removed,
    quoteReference: null,
  };
  if (!inbound) return { ...result, duplicate: true };

  // Un asesor tiene (o está por tomar) la conversación: la IA no responde.
  if (conversation.status === "esperando_asesor" || conversation.status === "asesor") return result;

  if ((await store.countRecentInbound(conversation.id, 10)) > MAX_INBOUND_PER_10_MIN) return result;

  const say = async (texts: string[], intent: Intent | null) => {
    for (const text of texts) {
      const delivery = await sender.send(from, text);
      await store.insertMessage({
        conversationId: conversation.id,
        direction: "saliente",
        author: "ia",
        body: text,
        intent,
        externalId: delivery.externalId ?? null,
        deliveryStatus: delivery.status,
        isSimulated: msg.simulated,
      });
      result.replies.push(text);
    }
  };

  // ── Confirmación de una solicitud completa ──
  if (conversation.pendingAction === "confirmar_solicitud" && conversation.quoteDraft && isAcceptance(original)) {
    const reference = await registerQuote(deps, conversation, contact.id, inbound.id);
    await store.updateConversation(conversation.id, {
      pendingAction: null,
      quoteDraft: null,
      quoteRequestId: reference.id,
      intent: "cotizacion",
    });
    result.quoteReference = reference.reference;
    result.intent = "cotizacion";
    await say(
      [
        `¡Listo! ✅ Registramos tu solicitud ${reference.reference}. Un asesor de D&J revisará tus datos y te contactará por este chat.`,
        QUOTE_DISCLAIMER,
      ],
      "cotizacion",
    );
    return result;
  }

  // ── Turno del núcleo común ──
  const history = await store.recentHistory(conversation.id, HISTORY_WINDOW);
  const turn = await runAssistantTurn({
    history,
    lead: conversation.leadState,
    advisor: null,
    model: deps.model,
    channel: "whatsapp",
    healthDataRedacted: redacted.removed,
  });

  const status: ConversationStatus = turn.kind === "escalar" ? "esperando_asesor" : "bot";
  await store.updateConversation(conversation.id, {
    leadState: turn.lead,
    intent: turn.intent,
    escalationReason: turn.escalation,
    status,
    // Un borrador nuevo queda esperando "ACEPTO"; cualquier otro resultado cancela la confirmación pendiente.
    pendingAction: turn.draft ? "confirmar_solicitud" : null,
    quoteDraft: turn.draft,
  });
  Object.assign(result, {
    status,
    intent: turn.intent,
    escalation: turn.escalation,
    known: turn.known,
    missing: turn.missing,
  });

  const replies = [turn.reply];
  if (turn.draft) replies.push(summaryMessage(turn.draft), consentMessage(deps.siteUrl));
  await say(replies, turn.intent);
  return result;
}

/** Registra las autorizaciones A y B y la solicitud (misma función y validación que la web). */
async function registerQuote(deps: Deps, conversation: Conversation, contactId: string, evidenceMessageId: string) {
  const { store } = deps;
  const draft = conversation.quoteDraft!;
  const validation = validateAssistantForm(draft.insuranceType, {
    ...draft.form,
    privacyAccepted: true,
    dataConsent: true,
  });
  if (!validation.success) throw new Error("El borrador ya no es válido.");

  await store.recordConsents(
    (["politica_terminos", "tratamiento_datos"] as const).map((consentType) => ({
      contactId,
      conversationId: conversation.id,
      consentType,
      granted: true,
      privacyPolicyVersion: LEGAL_VERSIONS.privacyPolicy,
      termsVersion: LEGAL_VERSIONS.terms,
      consentTextVersion: WHATSAPP_CONSENT_TEXT_VERSION,
      evidenceMessageId,
    })),
  );

  const consent = {
    privacy_policy_version: LEGAL_VERSIONS.privacyPolicy,
    terms_version: LEGAL_VERSIONS.terms,
    accepted_at: new Date().toISOString(),
    source: "whatsapp",
    privacy_policy_read: true,
    data_processing: true,
    // C no se pide por WhatsApp en esta fase: un asesor la solicitará antes de compartir datos.
    insurer_transfer: false,
    consent_text_version: WHATSAPP_CONSENT_TEXT_VERSION,
  };
  const submission = buildQuoteSubmission(
    draft.insuranceType,
    validation.data as AssistantQuoteForm,
    draft.notes ?? leadNotes(conversation.leadState),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await store.submitQuoteRequest(newRequestReference(), submission, conversation.assignedAdvisorId, consent);
    } catch (error) {
      if (!(error instanceof DuplicateReferenceError)) throw error;
    }
  }
  throw new Error("No fue posible generar una referencia única.");
}
