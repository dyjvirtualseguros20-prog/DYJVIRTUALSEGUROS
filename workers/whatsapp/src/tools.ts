/**
 * ACCIONES DE LA IA EN WHATSAPP (paso 2.5)
 * ────────────────────────────────────────
 * La IA no escribe directamente el estado del negocio: lo hace con estas herramientas, a través
 * del ToolRunner (server/tools/runner.ts), que valida actor, política, entrada, autorización e
 * idempotencia y deja un evento en audit_events. Los mensajes del chat (entrantes y respuestas)
 * no son acciones: son el registro de la conversación y se guardan como antes.
 *
 * En esta etapa la IA solo puede lo que ya hacía:
 *   conversacion.actualizar_turno  EJECUTAR  intención, datos y borrador de SU conversación
 *   conversacion.escalar           ESCALAR   pasar la conversación a una persona
 *   solicitud.registrar            EJECUTAR  solo con el ACEPTO del cliente (autorizaciones A y B)
 *   conversacion.asignar_asesor    PROPONER  requiere una persona: la IA solo puede proponerla
 *   contexto.consultar_solicitudes LEER      estado real de las solicitudes de ESE contacto
 *   solicitud.pedir_revision       PROPONER  "está muy caro / otra opción": lo decide un asesor
 */
import { z } from "zod";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { buildQuoteSubmission, newRequestReference } from "@/lib/quoteSubmission";
import { validateAssistantForm, type AssistantQuoteForm } from "@/lib/validation/quoteSchemas";
import { leadNotes } from "@/server/assistant/lead";
import type { Actor, ToolDefinition } from "@/server/tools/runner";
import {
  type ChatStore,
  type ContactRequest,
  type Conversation,
  type ConversationPatch,
  DuplicateReferenceError,
} from "./store";

/**
 * Versión del mensaje de autorización que se muestra por WhatsApp. Reutiliza los textos vigentes
 * de las casillas de la web (lib/legal.ts); el texto jurídico definitivo para WhatsApp está
 * PENDIENTE de revisión y, cuando exista, se cambia aquí junto con esta versión.
 */
export const WHATSAPP_CONSENT_TEXT_VERSION = "wa-tecnico-1-pendiente-revision-juridica";

/** La IA del canal WhatsApp como actor de la auditoría. */
export const IA_WHATSAPP: Actor = { type: "ia", id: "asesor-virtual", channel: "whatsapp", active: true };

export interface WaToolDeps {
  store: ChatStore;
}

const conversationRef = z.custom<Conversation>(
  (v) => typeof v === "object" && v !== null && typeof (v as Conversation).id === "string",
);
const patchRef = z.custom<ConversationPatch>((v) => typeof v === "object" && v !== null);

/* ───────────────────────── Turno de la IA y escalamiento ───────────────────────── */

const turnInput = z.object({
  conversationId: z.string().min(1),
  expectedVersion: z.number().int().min(0),
  patch: patchRef,
});
type TurnInput = z.infer<typeof turnInput>;

const turnSummary = (i: TurnInput) => ({
  intent: i.patch.intent ?? null,
  status: i.patch.status ?? null,
  escalationReason: i.patch.escalationReason ?? null,
  conBorrador: Boolean(i.patch.quoteDraft),
});

/** Guarda el resultado del turno con la versión leída: nunca escribe encima de un asesor. */
async function applyTurn({ deps }: { deps: WaToolDeps }, i: TurnInput) {
  return { version: await deps.store.updateConversation(i.conversationId, i.patch, i.expectedVersion) };
}

export const actualizarTurno: ToolDefinition<TurnInput, { version: number }, WaToolDeps> = {
  name: "conversacion.actualizar_turno",
  level: "ejecutar",
  actors: ["ia"],
  input: turnInput.refine((i) => i.patch.status !== "asesor" && i.patch.status !== "esperando_asesor", {
    message: "Para pasar a una persona se usa conversacion.escalar",
  }),
  resource: (i) => ({ type: "chat_conversation", id: i.conversationId }),
  execute: applyTurn,
  summarize: turnSummary,
};

export const escalarConversacion: ToolDefinition<TurnInput, { version: number }, WaToolDeps> = {
  name: "conversacion.escalar",
  level: "escalar",
  actors: ["ia", "sistema"],
  input: turnInput.refine((i) => i.patch.status === "esperando_asesor" && Boolean(i.patch.escalationReason), {
    message: "Escalar exige estado esperando_asesor y un motivo",
  }),
  resource: (i) => ({ type: "chat_conversation", id: i.conversationId }),
  execute: applyTurn,
  summarize: turnSummary,
};

/* ─────────────────────────────── Registrar solicitud ─────────────────────────────── */

const registerInput = z.object({
  conversation: conversationRef,
  contactId: z.string().min(1),
  /** Mensaje del cliente con el ACEPTO (evidencia de las autorizaciones A y B). */
  evidenceMessageId: z.string().min(1).nullable(),
  /** El cliente respondió ACEPTO (lo comprueba el canal sobre el texto original). */
  accepted: z.boolean(),
});
type RegisterInput = z.infer<typeof registerInput>;

export const registrarSolicitud: ToolDefinition<RegisterInput, { id: string; reference: string }, WaToolDeps> = {
  name: "solicitud.registrar",
  level: "ejecutar",
  actors: ["ia"],
  input: registerInput,
  resource: (i) => ({ type: "chat_conversation", id: i.conversation.id }),
  // Autorización: solo con un borrador pendiente de confirmar y el ACEPTO explícito del cliente.
  authorize: (_ctx, i) => {
    if (i.conversation.pendingAction !== "confirmar_solicitud" || !i.conversation.quoteDraft)
      return "sin_borrador_pendiente";
    if (!i.accepted) return "sin_autorizacion_del_cliente";
    return null;
  },
  async execute({ deps }, i) {
    const { store } = deps;
    const conversation = i.conversation;
    // Se "reclama" la confirmación con la versión leída: si dos procesos (o un reintento) llegan
    // aquí, solo uno puede registrar la solicitud. Si después algo falla, el borrador se conserva
    // y el asistente vuelve a pedir la confirmación: nunca se crea una solicitud doble.
    const claimed = await store.updateConversation(conversation.id, { pendingAction: null }, conversation.version);
    const reference = await registerQuote(store, conversation, i.contactId, i.evidenceMessageId);
    // Contacto ↔ solicitud ↔ conversación (para el seguimiento: "¿qué pasó con mi cotización?").
    await store.linkContactRequest(i.contactId, reference.id, conversation.id);
    await store.updateConversation(
      conversation.id,
      { quoteDraft: null, quoteRequestId: reference.id, intent: "cotizacion" },
      claimed,
    );
    return reference;
  },
  summarize: (i, out) => ({
    insuranceType: i.conversation.quoteDraft?.insuranceType ?? null,
    reference: out?.reference ?? null,
    autorizaciones: ["politica_terminos", "tratamiento_datos"],
  }),
};

/** Registra las autorizaciones A y B y la solicitud (misma función y validación que la web). */
async function registerQuote(
  store: ChatStore,
  conversation: Conversation,
  contactId: string,
  evidenceMessageId: string | null,
) {
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

/* ───────────────────────── Acción que la IA solo puede PROPONER ───────────────────────── */

const assignInput = z.object({ conversationId: z.string().min(1), advisorId: z.string().regex(/^[a-z0-9-]{1,30}$/) });

/**
 * Cambiar el asesor de una conversación es una decisión de una persona: si la IA la pide, queda
 * como propuesta pendiente (action_proposals) y no se ejecuta. Todavía no la usa el flujo.
 */
export const asignarAsesor: ToolDefinition<z.infer<typeof assignInput>, never, WaToolDeps> = {
  name: "conversacion.asignar_asesor",
  level: "proponer",
  actors: ["ia"],
  requiresHuman: true,
  input: assignInput,
  resource: (i) => ({ type: "chat_conversation", id: i.conversationId }),
  async execute() {
    throw new Error("Solo una persona puede asignar el asesor.");
  },
  summarize: (i) => ({ advisorId: i.advisorId }),
};

/* ─────────────────────────────── Contexto del cliente ─────────────────────────────── */

const contactInput = z.object({ contactId: z.string().min(1), conversationId: z.string().min(1) });

/** LEER: solicitudes registradas desde este mismo contacto (nunca las de otro número). */
export const consultarSolicitudes: ToolDefinition<z.infer<typeof contactInput>, ContactRequest[], WaToolDeps> = {
  name: "contexto.consultar_solicitudes",
  level: "leer",
  actors: ["ia"],
  input: contactInput,
  resource: (i) => ({ type: "chat_contact", id: i.contactId }),
  execute: ({ deps }, i) => deps.store.contactRequests(i.contactId),
  summarize: (_i, out) => ({ solicitudes: out?.length ?? 0 }),
};

/**
 * PROPONER: el cliente pide otra opción, revisar el precio o un descuento. La IA no tiene precios
 * ni puede negociar: deja la petición pendiente para su asesor (action_proposals) y escala.
 */
export const pedirRevision: ToolDefinition<z.infer<typeof contactInput> & { solicitudes: number }, never, WaToolDeps> =
  {
    name: "solicitud.pedir_revision",
    level: "proponer",
    actors: ["ia"],
    requiresHuman: true,
    input: contactInput.extend({ solicitudes: z.number().int().min(0) }),
    resource: (i) => ({ type: "chat_conversation", id: i.conversationId }),
    async execute() {
      throw new Error("Solo un asesor puede revisar opciones o precios.");
    },
    summarize: (i) => ({ solicitudes: i.solicitudes }),
  };
