/**
 * CANAL WHATSAPP sobre el núcleo común del Asesor IA D&J
 * ──────────────────────────────────────────────────────
 *   lote de mensajes entrantes (uno o una ráfaga, ya ordenados por la fila del cliente: queue.ts)
 *     ├─ cada mensaje se guarda INDIVIDUALMENTE (con su ID): duplicados → se ignoran
 *     ├─ datos de salud                        → se ocultan ANTES de guardar cada mensaje
 *     ├─ conversación con un asesor            → se guardan y la IA NO responde
 *     ├─ esperando confirmación de solicitud   → "ACEPTO" registra autorizaciones + solicitud
 *     └─ resto → UN turno del núcleo (server/assistant/core.ts) con la ráfaga como un solo mensaje
 *           ├─ escalar  → estado esperando_asesor (la IA deja de responder)
 *           ├─ borrador → resumen + autorizaciones, estado de confirmación
 *           └─ responder / pedir solo lo que falta
 *
 *   Escrituras con versión (migración 0007): si la conversación cambió mientras se procesaba
 *   (p. ej. un asesor la tomó), se lanza StaleConversationError y la fila reintenta con el
 *   estado nuevo. Las respuestas tienen ID propio: un reintento no las duplica.
 *
 *   Acciones (paso 2.5): los cambios de estado del negocio (turno, escalamiento, registrar la
 *   solicitud) pasan por el ToolRunner (src/tools.ts): política, autorización, idempotencia y
 *   un evento en audit_events por cada una.
 */
import { cleanText, EMPTY_LEAD, type LeadState, type QuoteDraft } from "@/lib/chat";
import { CONSENT_TEXT, QUOTE_DISCLAIMER } from "@/lib/legal";
import type { ModelSource } from "@/server/ai/router";
import { HISTORY_WINDOW, runAssistantTurn, type EscalationReason, type Intent } from "@/server/assistant/core";
import { redactHealthData } from "@/server/assistant/grounding";
import { createToolRunner } from "@/server/tools/runner";
import type { ChatStore, ConversationStatus } from "./store";
import type { OutboundSender } from "./sender";
import { actualizarTurno, escalarConversacion, IA_WHATSAPP, registrarSolicitud } from "./tools";

export { WHATSAPP_CONSENT_TEXT_VERSION } from "./tools";

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
  /** La fila ya ocultó datos de salud de este texto antes de guardarlo (se conserva el aviso). */
  healthRedacted?: boolean;
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
  /** IDs de los mensajes del cliente que se procesaron juntos en este turno. */
  messageIds: string[];
}

export interface Deps {
  store: ChatStore;
  /** Modelos por tarea (server/ai/router.ts). */
  models: ModelSource;
  sender: OutboundSender;
  defaultAdvisorId: string | null;
  siteUrl: string;
}

export interface BatchOptions {
  /**
   * Reintento de un lote que no terminó: los mensajes que ya se habían guardado se reutilizan
   * (no son duplicados) y se completa el turno pendiente.
   */
  resume?: boolean;
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

/** Un mensaje (compatibilidad con la Fase 1): es un lote de uno. */
export async function handleIncoming(deps: Deps, msg: Incoming): Promise<Outcome> {
  return handleIncomingBatch(deps, [msg]);
}

/**
 * Procesa un lote ORDENADO de mensajes del mismo número (la fila del cliente garantiza que
 * nunca hay dos lotes del mismo número a la vez). Lanza error si algo falla: la fila lo reintenta.
 */
export async function handleIncomingBatch(deps: Deps, msgs: Incoming[], options: BatchOptions = {}): Promise<Outcome> {
  const { store, sender } = deps;
  if (!msgs.length) throw new Error("Lote vacío.");
  const tools = createToolRunner(store.tools);
  const from = msgs[0].from.replace(/\D/g, "");
  if (!/^[0-9]{8,15}$/.test(from)) throw new Error("Número de WhatsApp no válido.");
  if (msgs.some((m) => m.from.replace(/\D/g, "") !== from)) throw new Error("Un lote solo puede tener mensajes de un número.");
  const name = [...msgs].reverse().find((m) => m.name?.trim())?.name?.trim().slice(0, 120) || null;

  const contact = await store.upsertContact(from, name);
  // Asesor de la conversación: el del contacto, o el predeterminado si está activo (si no, sin asesor).
  let advisorId = contact.advisorId;
  if (!advisorId && deps.defaultAdvisorId && (await store.isActiveAdvisor(deps.defaultAdvisorId)))
    advisorId = deps.defaultAdvisorId;
  const conversation = await store.openConversation(contact, advisorId, initialLead(from));

  // ── 1. Guardar cada mensaje individualmente (orden de la fila), ocultando datos de salud ──
  const nuevos: Array<{ original: string; redacted: string; storedId: string | null; messageId: string }> = [];
  let healthRedacted = false;
  for (const msg of msgs) {
    const original = cleanText(msg.text).slice(0, 4000);
    if (!original) continue;
    const redacted = redactHealthData(original);
    const inserted = await store.insertMessage({
      conversationId: conversation.id,
      direction: "entrante",
      author: "cliente",
      body: redacted.text,
      healthRedacted: redacted.removed || Boolean(msg.healthRedacted),
      externalId: msg.messageId,
      deliveryStatus: "recibido",
      isSimulated: msg.simulated,
    });
    // Ya existía: en un reintento es el mismo mensaje (se reutiliza); si no, es un duplicado.
    if (!inserted && !options.resume) continue;
    nuevos.push({ original, redacted: redacted.text, storedId: inserted?.id ?? null, messageId: msg.messageId });
    healthRedacted ||= redacted.removed || Boolean(msg.healthRedacted);
  }

  const result: Outcome = {
    duplicate: false,
    conversationId: conversation.id,
    status: conversation.status,
    intent: conversation.intent,
    escalation: conversation.escalationReason,
    replies: [],
    known: [],
    missing: [],
    healthRedacted,
    quoteReference: null,
    messageIds: nuevos.map((n) => n.messageId),
  };
  if (!nuevos.length) return { ...result, duplicate: true };

  // Un asesor tiene (o está por tomar) la conversación: la IA no responde.
  if (conversation.status === "esperando_asesor" || conversation.status === "asesor") return result;

  if ((await store.countRecentInbound(conversation.id, 10)) > MAX_INBOUND_PER_10_MIN) return result;

  // Las respuestas tienen un ID derivado del primer mensaje del lote: si un reintento vuelve a
  // generar la misma respuesta, no se guarda ni se envía dos veces.
  const replyKey = `${nuevos[0].messageId}:r`;
  let replyIndex = 0;
  const say = async (texts: string[], intent: Intent | null) => {
    for (const text of texts) {
      const externalId = `${replyKey}${replyIndex++}`;
      if (await store.messageExists(externalId)) continue;
      const delivery = await sender.send(from, text);
      await store.insertMessage({
        conversationId: conversation.id,
        direction: "saliente",
        author: "ia",
        body: text,
        intent,
        externalId,
        deliveryStatus: delivery.status,
        isSimulated: msgs[0].simulated,
      });
      result.replies.push(text);
    }
  };

  // ── 2. Confirmación de una solicitud completa ──
  const evidence = nuevos.find((n) => isAcceptance(n.original));
  if (conversation.pendingAction === "confirmar_solicitud" && conversation.quoteDraft && evidence) {
    // ToolRunner: autorización (ACEPTO + borrador), idempotencia por conversación y mensaje, auditoría.
    // Un error se relanza: la fila reintenta (la clave se libera y el borrador se conserva).
    const registered = await tools.runOrThrow(
      registrarSolicitud,
      IA_WHATSAPP,
      { store },
      { conversation, contactId: contact.id, evidenceMessageId: evidence.storedId, accepted: true },
      { idempotencyKey: `solicitud.registrar:${conversation.id}:${evidence.messageId}` },
    );
    // Otro proceso tiene la misma confirmación en curso: se reintenta más tarde (la fila).
    if (registered.status === "denegado" && registered.reason === "en_curso") throw new Error("Registro en curso en otro proceso.");
    if (registered.status === "denegado" || registered.status === "propuesto") {
      // La acción está desactivada o requiere una persona: no se registra y se pasa a un asesor.
      await escalate(tools, store, conversation.id, conversation.version);
      result.status = "esperando_asesor";
      result.escalation = "asesor_humano";
      await say(["Gracias. Un asesor de D&J revisará tus datos y te escribirá por este chat para registrar tu solicitud."], "cotizacion");
      return result;
    }
    const reference = registered.data as { id: string; reference: string };
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

  // ── 3. Turno del núcleo común (la ráfaga se interpreta como un solo mensaje) ──
  const history = collapseBurst(await store.recentHistory(conversation.id, HISTORY_WINDOW + nuevos.length - 1), nuevos.length);
  const turn = await runAssistantTurn({
    history,
    lead: conversation.leadState,
    advisor: null,
    models: deps.models,
    channel: "whatsapp",
    healthDataRedacted: healthRedacted,
  });

  const status: ConversationStatus = turn.kind === "escalar" ? "esperando_asesor" : "bot";
  // Con la versión leída: si un asesor tomó la conversación mientras tanto, NO se escribe encima.
  const saved = await tools.runOrThrow(turn.kind === "escalar" ? escalarConversacion : actualizarTurno, IA_WHATSAPP, { store }, {
    conversationId: conversation.id,
    expectedVersion: conversation.version,
    patch: {
      leadState: turn.lead,
      intent: turn.intent,
      escalationReason: turn.escalation,
      status,
      // Un borrador nuevo queda esperando "ACEPTO"; cualquier otro resultado cancela la confirmación pendiente.
      pendingAction: turn.draft ? "confirmar_solicitud" : null,
      quoteDraft: turn.draft,
    },
  });
  // Acción desactivada en tool_policies: la IA no guarda ni responde (los mensajes quedan guardados).
  if (saved.status !== "ok") return result;
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

/**
 * Los últimos `count` mensajes del cliente (la ráfaga) se presentan al núcleo como UN solo
 * mensaje, en orden. Así el asistente lee "Hola / quiero cotizar / una Mazda CX-5 / 2024" como una
 * sola petición. En la base de datos siguen guardados por separado.
 */
function collapseBurst(history: Array<{ role: "user" | "assistant"; content: string }>, count: number) {
  if (count <= 1) return history;
  const tail = history.slice(-count);
  if (tail.length !== count || tail.some((m) => m.role !== "user")) return history;
  return [...history.slice(0, -count), { role: "user" as const, content: tail.map((m) => m.content).join("\n") }];
}

/** Pasa la conversación a una persona (ToolRunner: conversacion.escalar). */
async function escalate(tools: ReturnType<typeof createToolRunner>, store: ChatStore, conversationId: string, version: number) {
  await tools.runOrThrow(escalarConversacion, IA_WHATSAPP, { store }, {
    conversationId,
    expectedVersion: version,
    patch: { status: "esperando_asesor", escalationReason: "asesor_humano", pendingAction: null },
  });
}
