/**
 * ALMACENAMIENTO DE CONVERSACIONES
 * ────────────────────────────────
 * Interfaz común + dos implementaciones:
 *   - PostgresStore: Supabase (tablas chat_*), con el rol wa_bot.
 *   - MemoryStore:   en memoria, solo para las pruebas automáticas (sin base de datos).
 */
import postgres from "postgres";
import { EMPTY_LEAD, type LeadState, type QuoteDraft } from "@/lib/chat";
import type { QuoteSubmission } from "@/lib/quoteSubmission";
import type { EscalationReason, Intent } from "@/server/assistant/core";

export type ConversationStatus = "bot" | "esperando_asesor" | "asesor" | "cerrada";

export interface Contact {
  id: string;
  externalId: string;
  displayName: string | null;
  advisorId: string | null;
}

export interface Conversation {
  id: string;
  contactId: string;
  status: ConversationStatus;
  intent: Intent | null;
  escalationReason: EscalationReason | null;
  leadState: LeadState;
  pendingAction: "confirmar_solicitud" | null;
  quoteDraft: QuoteDraft | null;
  quoteRequestId: string | null;
  assignedAdvisorId: string | null;
  /** Sube con cada cambio de estado (trigger de la migración 0007). */
  version: number;
}

/** La conversación cambió (otro proceso o un asesor) desde que se leyó: no se escribe encima. */
export class StaleConversationError extends Error {}

export interface NewMessage {
  conversationId: string;
  direction: "entrante" | "saliente";
  author: "cliente" | "ia" | "asesor" | "sistema";
  messageType?: "texto" | "audio" | "imagen" | "documento" | "interactivo" | "otro";
  body: string;
  healthRedacted?: boolean;
  intent?: Intent | null;
  externalId?: string | null;
  deliveryStatus: "recibido" | "simulado" | "enviado" | "fallido";
  isSimulated: boolean;
}

export interface ConsentRow {
  contactId: string;
  conversationId: string;
  consentType: "politica_terminos" | "tratamiento_datos" | "envio_aseguradoras";
  granted: boolean;
  privacyPolicyVersion: string;
  termsVersion: string;
  consentTextVersion: string;
  evidenceMessageId: string | null;
}

export type ConversationPatch = Partial<
  Pick<
    Conversation,
    "status" | "intent" | "escalationReason" | "leadState" | "pendingAction" | "quoteDraft" | "quoteRequestId"
  >
>;

export interface ChatStore {
  upsertContact(externalId: string, displayName: string | null): Promise<Contact>;
  /** Conversación abierta del contacto, o una nueva con el lead inicial. */
  openConversation(contact: Contact, advisorId: string | null, initialLead: LeadState): Promise<Conversation>;
  /** null si el mensaje ya existía (mismo external_id): mensaje duplicado. */
  insertMessage(message: NewMessage): Promise<{ id: string } | null>;
  /** Historial reciente en formato del asistente (cliente → user; IA/asesor/sistema → assistant). */
  recentHistory(conversationId: string, limit: number): Promise<Array<{ role: "user" | "assistant"; content: string }>>;
  /**
   * Cambia el estado de la conversación. Con `expectedVersion`, solo se aplica si nadie la cambió
   * desde que se leyó (si no, StaleConversationError). Devuelve la versión resultante.
   */
  updateConversation(id: string, patch: ConversationPatch, expectedVersion?: number): Promise<number>;
  /** ¿Ya existe un mensaje con este ID externo (Meta, simulación o respuesta)? */
  messageExists(externalId: string): Promise<boolean>;
  recordConsents(rows: ConsentRow[]): Promise<void>;
  countRecentInbound(conversationId: string, minutes: number): Promise<number>;
  isActiveAdvisor(id: string): Promise<boolean>;
  /** Registra la solicitud con public.submit_quote_request (source = 'whatsapp'). */
  submitQuoteRequest(
    reference: string,
    submission: QuoteSubmission,
    advisorId: string | null,
    consent: Record<string, unknown>,
  ): Promise<{ id: string; reference: string }>;
  /** Cierra la conversación abierta (solo para reiniciar pruebas de simulación). */
  closeOpenConversation(externalId: string): Promise<void>;
  end(): Promise<void>;
}

/** Error de referencia repetida (se reintenta con otra). */
export class DuplicateReferenceError extends Error {}

const leadFrom = (value: unknown): LeadState => {
  const v = (value ?? {}) as Partial<LeadState>;
  return {
    insuranceType: v.insuranceType ?? null,
    fields: v.fields ?? {},
    coverage: v.coverage ?? "",
    useType: v.useType ?? "",
    notes: v.notes ?? "",
  };
};

/* ─────────────────────────── Supabase (Postgres) ─────────────────────────── */

/**
 * `connectionString`: la de Hyperdrive (env.HYPERDRIVE.connectionString). Hyperdrive mantiene el pool
 * hacia Supabase, así que crear un cliente por petición es lo recomendado. Una sola conexión por
 * petición (las operaciones son secuenciales) y tiempos de espera cortos: un fallo de la base de
 * datos termina en error rápido, sin reintentos en bucle.
 */
export function createPostgresStore(connectionString: string): ChatStore {
  const sql = postgres(connectionString, {
    max: 1,
    fetch_types: false,
    prepare: true,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 60,
  });

  const toConversation = (r: Record<string, unknown>): Conversation => ({
    id: String(r.id),
    contactId: String(r.contact_id),
    status: r.status as ConversationStatus,
    intent: (r.intent as Intent | null) ?? null,
    escalationReason: (r.escalation_reason as EscalationReason | null) ?? null,
    leadState: leadFrom(r.lead_state),
    pendingAction: (r.pending_action as Conversation["pendingAction"]) ?? null,
    quoteDraft: (r.quote_draft as QuoteDraft | null) ?? null,
    quoteRequestId: (r.quote_request_id as string | null) ?? null,
    assignedAdvisorId: (r.assigned_advisor_id as string | null) ?? null,
    version: Number(r.version ?? 0),
  });

  return {
    async upsertContact(externalId, displayName) {
      const [r] = await sql`
        insert into public.chat_contacts (channel, external_id, display_name)
        values ('whatsapp', ${externalId}, ${displayName})
        on conflict (channel, external_id) do update
          set display_name = coalesce(excluded.display_name, public.chat_contacts.display_name)
        returning id, external_id, display_name, advisor_id`;
      return { id: r.id, externalId: r.external_id, displayName: r.display_name, advisorId: r.advisor_id };
    },

    async openConversation(contact, advisorId, initialLead) {
      const [open] = await sql`
        select * from public.chat_conversations where contact_id = ${contact.id} and status <> 'cerrada' limit 1`;
      if (open) return toConversation(open);
      const [created] = await sql`
        insert into public.chat_conversations (contact_id, channel, assigned_advisor_id, lead_state)
        values (${contact.id}, 'whatsapp', ${advisorId}, ${sql.json(initialLead as unknown as postgres.JSONValue)})
        on conflict (contact_id) where status <> 'cerrada' do nothing
        returning *`;
      if (created) return toConversation(created);
      // Otra petición la creó al mismo tiempo.
      const [again] = await sql`
        select * from public.chat_conversations where contact_id = ${contact.id} and status <> 'cerrada' limit 1`;
      return toConversation(again);
    },

    async insertMessage(m) {
      const rows = await sql`
        insert into public.chat_messages
          (conversation_id, direction, author, message_type, body, health_redacted, intent, external_id, delivery_status, is_simulated)
        values (${m.conversationId}, ${m.direction}, ${m.author}, ${m.messageType ?? "texto"}, ${m.body},
                ${m.healthRedacted ?? false}, ${m.intent ?? null}, ${m.externalId ?? null}, ${m.deliveryStatus}, ${m.isSimulated})
        on conflict (external_id) do nothing
        returning id`;
      if (!rows.length) return null;
      await sql`update public.chat_conversations set last_message_at = now() where id = ${m.conversationId}`;
      return { id: rows[0].id };
    },

    async recentHistory(conversationId, limit) {
      const rows = await sql`
        select author, body from (
          select author, body, created_at from public.chat_messages
          where conversation_id = ${conversationId} and body is not null
          order by created_at desc limit ${limit}
        ) t order by created_at asc`;
      return rows.map((r) => ({ role: r.author === "cliente" ? "user" : "assistant", content: String(r.body) }));
    },

    async updateConversation(id, patch, expectedVersion) {
      const columns: Record<string, unknown> = {};
      if ("status" in patch) columns.status = patch.status;
      if ("intent" in patch) columns.intent = patch.intent;
      if ("escalationReason" in patch) columns.escalation_reason = patch.escalationReason;
      if ("leadState" in patch) columns.lead_state = sql.json(patch.leadState as unknown as postgres.JSONValue);
      if ("pendingAction" in patch) columns.pending_action = patch.pendingAction;
      if ("quoteDraft" in patch)
        columns.quote_draft = patch.quoteDraft ? sql.json(patch.quoteDraft as unknown as postgres.JSONValue) : null;
      if ("quoteRequestId" in patch) columns.quote_request_id = patch.quoteRequestId;
      const set = sql(columns as Record<string, postgres.ParameterOrJSON<never>>);
      if (!Object.keys(columns).length) {
        const [r] = await sql`select version from public.chat_conversations where id = ${id}`;
        if (expectedVersion !== undefined && r && Number(r.version) !== expectedVersion)
          throw new StaleConversationError("La conversación cambió mientras se procesaba el mensaje.");
        return Number(r?.version ?? 0);
      }
      // La versión la sube el trigger 0007; aquí solo se exige que no haya cambiado desde la lectura.
      const rows =
        expectedVersion === undefined
          ? await sql`update public.chat_conversations set ${set} where id = ${id} returning version`
          : await sql`update public.chat_conversations set ${set} where id = ${id} and version = ${expectedVersion} returning version`;
      if (!rows.length) throw new StaleConversationError("La conversación cambió mientras se procesaba el mensaje.");
      return Number(rows[0].version);
    },

    async messageExists(externalId) {
      const rows = await sql`select 1 from public.chat_messages where external_id = ${externalId} limit 1`;
      return rows.length > 0;
    },

    async recordConsents(rows) {
      for (const c of rows) {
        await sql`
          insert into public.chat_consents
            (contact_id, conversation_id, channel, consent_type, granted, privacy_policy_version, terms_version,
             consent_text_version, evidence_message_id)
          values (${c.contactId}, ${c.conversationId}, 'whatsapp', ${c.consentType}, ${c.granted}, ${c.privacyPolicyVersion},
                  ${c.termsVersion}, ${c.consentTextVersion}, ${c.evidenceMessageId})`;
      }
    },

    async countRecentInbound(conversationId, minutes) {
      const [r] = await sql`
        select count(*)::int as n from public.chat_messages
        where conversation_id = ${conversationId} and direction = 'entrante'
          and created_at > now() - make_interval(mins => ${minutes})`;
      return r.n;
    },

    async isActiveAdvisor(id) {
      const rows = await sql`select 1 from public.advisors where id = ${id} and active`;
      return rows.length > 0;
    },

    async submitQuoteRequest(reference, s, advisorId, consent) {
      try {
        const [r] = await sql`
          select * from public.submit_quote_request(
            ${reference}, ${s.insuranceType}, ${s.fullName}, ${s.identification ?? ""}, ${s.phone}, ${s.whatsapp},
            ${s.email ?? ""}, ${s.city ?? ""}, ${sql.json(s.formData as postgres.JSONValue)}, ${advisorId},
            'whatsapp', ${sql.json(consent as postgres.JSONValue)})`;
        return { id: r.id, reference: r.reference };
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new DuplicateReferenceError("referencia repetida");
        throw error;
      }
    },

    async closeOpenConversation(externalId) {
      await sql`
        update public.chat_conversations set status = 'cerrada', closed_at = now()
        where status <> 'cerrada' and contact_id in (
          select id from public.chat_contacts where channel = 'whatsapp' and external_id = ${externalId})`;
    },

    async end() {
      await sql.end({ timeout: 5 });
    },
  };
}

/* ─────────────────────────── Memoria (pruebas) ─────────────────────────── */

export interface MemoryState {
  contacts: Contact[];
  conversations: Conversation[];
  messages: Array<NewMessage & { id: string; createdAt: number }>;
  consents: ConsentRow[];
  quoteRequests: Array<{ id: string; reference: string; submission: QuoteSubmission; advisorId: string | null; consent: Record<string, unknown> }>;
}

/** Campos que, al cambiar, suben la versión (igual que el trigger de la migración 0007). */
const VERSIONED: Array<keyof Conversation> = [
  "status",
  "intent",
  "escalationReason",
  "leadState",
  "pendingAction",
  "quoteDraft",
  "quoteRequestId",
  "assignedAdvisorId",
];

type MemoryOp = "insertMessage" | "updateConversation" | "recentHistory";

export function createMemoryStore(
  activeAdvisors: string[] = ["cristian", "jeisson"],
): ChatStore & { state: MemoryState; failOnce(op: MemoryOp): void } {
  const state: MemoryState = { contacts: [], conversations: [], messages: [], consents: [], quoteRequests: [] };
  let seq = 0;
  const id = () => `mem-${++seq}`;
  const pendingFailures: MemoryOp[] = [];
  /** Simula una caída de la base de datos en la próxima operación de ese tipo (solo pruebas). */
  const maybeFail = (op: MemoryOp) => {
    const i = pendingFailures.indexOf(op);
    if (i >= 0) {
      pendingFailures.splice(i, 1);
      throw new Error(`Base de datos no disponible (simulado: ${op})`);
    }
  };
  return {
    state,
    failOnce(op) {
      pendingFailures.push(op);
    },
    async upsertContact(externalId, displayName) {
      let c = state.contacts.find((x) => x.externalId === externalId);
      if (!c) state.contacts.push((c = { id: id(), externalId, displayName, advisorId: null }));
      else if (displayName) c.displayName = displayName;
      return { ...c };
    },
    async openConversation(contact, advisorId, initialLead) {
      let c = state.conversations.find((x) => x.contactId === contact.id && x.status !== "cerrada");
      if (!c) {
        c = {
          id: id(),
          contactId: contact.id,
          status: "bot",
          intent: null,
          escalationReason: null,
          leadState: structuredClone(initialLead ?? EMPTY_LEAD),
          pendingAction: null,
          quoteDraft: null,
          quoteRequestId: null,
          assignedAdvisorId: advisorId,
          version: 0,
        };
        state.conversations.push(c);
      }
      return structuredClone(c);
    },
    async insertMessage(m) {
      maybeFail("insertMessage");
      if (m.externalId && state.messages.some((x) => x.externalId === m.externalId)) return null;
      const row = { ...m, id: id(), createdAt: seq };
      state.messages.push(row);
      return { id: row.id };
    },
    async recentHistory(conversationId, limit) {
      maybeFail("recentHistory");
      return state.messages
        .filter((m) => m.conversationId === conversationId && m.body)
        .slice(-limit)
        .map((m) => ({ role: m.author === "cliente" ? ("user" as const) : ("assistant" as const), content: m.body }));
    },
    async updateConversation(convId, patch, expectedVersion) {
      maybeFail("updateConversation");
      const c = state.conversations.find((x) => x.id === convId);
      if (!c) throw new StaleConversationError("La conversación no existe.");
      if (expectedVersion !== undefined && c.version !== expectedVersion)
        throw new StaleConversationError("La conversación cambió mientras se procesaba el mensaje.");
      const before = JSON.stringify(VERSIONED.map((k) => c[k]));
      Object.assign(c, structuredClone(patch));
      if (JSON.stringify(VERSIONED.map((k) => c[k])) !== before) c.version++;
      return c.version;
    },
    async messageExists(externalId) {
      return state.messages.some((m) => m.externalId === externalId);
    },
    async recordConsents(rows) {
      state.consents.push(...rows);
    },
    async countRecentInbound(conversationId) {
      return state.messages.filter((m) => m.conversationId === conversationId && m.direction === "entrante").length;
    },
    async isActiveAdvisor(advisor) {
      return activeAdvisors.includes(advisor);
    },
    async submitQuoteRequest(reference, submission, advisorId, consent) {
      const row = { id: id(), reference, submission, advisorId, consent };
      state.quoteRequests.push(row);
      return { id: row.id, reference };
    },
    async closeOpenConversation(externalId) {
      const contact = state.contacts.find((x) => x.externalId === externalId);
      for (const c of state.conversations) if (contact && c.contactId === contact.id) c.status = "cerrada";
    },
    async end() {},
  };
}
