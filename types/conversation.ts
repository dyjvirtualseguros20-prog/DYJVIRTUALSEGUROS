/** Conversaciones de WhatsApp (tablas chat_* de Supabase), tal como las ve el panel /admin. */

export const CONVERSATION_STATUSES = {
  bot: "Atendida por la IA",
  esperando_asesor: "Esperando asesor",
  asesor: "Con un asesor",
  cerrada: "Cerrada",
} as const;

export type ConversationStatus = keyof typeof CONVERSATION_STATUSES;
export const CONVERSATION_STATUS_KEYS = Object.keys(CONVERSATION_STATUSES) as ConversationStatus[];

export const isConversationStatus = (value: unknown): value is ConversationStatus =>
  typeof value === "string" && value in CONVERSATION_STATUSES;

export const CONVERSATION_INTENTS = {
  cotizacion: "Cotización",
  informacion: "Información",
  accidente: "Accidente / emergencia",
  renovacion: "Renovación",
  reclamacion: "Reclamación",
  asesor_humano: "Pidió un asesor",
  otro: "Otro",
} as const;

export type ConversationIntent = keyof typeof CONVERSATION_INTENTS;

export const ESCALATION_REASONS = {
  accidente: "Accidente o emergencia",
  reclamacion: "Reclamación",
  asesor_humano: "El cliente pidió hablar con una persona",
  baja_confianza: "La IA no estaba segura de entender",
} as const;

export type EscalationReason = keyof typeof ESCALATION_REASONS;

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  intent: ConversationIntent | null;
  escalationReason: EscalationReason | null;
  contactName: string | null;
  /** Número de WhatsApp con indicativo, solo dígitos. */
  contactNumber: string;
  assignedAdvisorId: string | null;
  takenBy: string | null;
  takenAt: string | null;
  quoteRequestId: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  direction: "entrante" | "saliente";
  author: "cliente" | "ia" | "asesor" | "sistema";
  messageType: string;
  body: string | null;
  healthRedacted: boolean;
  intent: ConversationIntent | null;
  deliveryStatus: string | null;
  isSimulated: boolean;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  /** Lo que la IA sabe de la solicitud en curso (LeadState). */
  leadState: Record<string, unknown>;
  quoteReference: string | null;
  consents: Array<{ type: string; granted: boolean; policyVersion: string; termsVersion: string; textVersion: string; createdAt: string }>;
}

export interface ConversationFilters {
  status?: ConversationStatus;
}

export interface ConversationUpdate {
  status: ConversationStatus;
  assignedAdvisorId: string | null;
  /** true = el asesor de la sesión toma la conversación (se registra quién y cuándo). */
  take: boolean;
}
