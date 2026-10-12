/**
 * DURABLE OBJECT: una fila por cliente (idFromName("whatsapp:<número>")).
 * Envoltura delgada sobre OrderedQueue (queue.ts): guarda la fila en el SQLite del objeto,
 * usa su alarma para las ráfagas y los reintentos, y procesa cada lote con handleIncomingBatch.
 * Cloudflare garantiza una sola instancia por nombre: todos los mensajes de un número pasan por aquí.
 */
import { DurableObject } from "cloudflare:workers";
import { redactHealthData } from "@/server/assistant/grounding";
import { consoleUsageSink, createWorkersAiRouter, singleModel } from "@/server/ai/router";
import { AiError } from "@/server/ai/model";
import { handleIncomingBatch, type Incoming } from "./conversation";
import type { Env } from "./env";
import { OrderedQueue, type QueueMessage, type QueueRow, type QueueStorage } from "./queue";
import { createCloudSender, simulatedSender } from "./sender";
import { createPostgresStore } from "./store";
import { fakeModel } from "./simulationModel";

/** Tope de tiempo de un lote (base de datos + IA). Si se supera, el lote falla y se reintenta. */
const BATCH_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Tiempo de espera agotado al procesar el lote.")), ms) as unknown as number;
    }),
  ]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}

/** Fila en el SQLite del Durable Object. */
class SqlQueueStorage implements QueueStorage {
  constructor(private sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS fila (
      id TEXT PRIMARY KEY, from_num TEXT NOT NULL, name TEXT, text TEXT NOT NULL, sent_at INTEGER,
      simulated INTEGER NOT NULL, options TEXT NOT NULL, state TEXT NOT NULL, received_at INTEGER NOT NULL,
      seq INTEGER NOT NULL, attempts INTEGER NOT NULL, starts INTEGER NOT NULL DEFAULT 0, not_before INTEGER NOT NULL,
      last_error TEXT, done_at INTEGER, outcome TEXT)`);
    sql.exec("CREATE INDEX IF NOT EXISTS fila_estado ON fila (state, seq)");
  }

  private toRow(r: Record<string, SqlStorageValue>): QueueRow {
    return {
      id: String(r.id),
      from: String(r.from_num),
      name: r.name === null ? null : String(r.name),
      text: String(r.text),
      sentAt: r.sent_at === null ? null : Number(r.sent_at),
      simulated: Number(r.simulated) === 1,
      options: JSON.parse(String(r.options)),
      state: String(r.state) as QueueRow["state"],
      receivedAt: Number(r.received_at),
      seq: Number(r.seq),
      attempts: Number(r.attempts),
      starts: Number(r.starts),
      notBefore: Number(r.not_before),
      lastError: r.last_error === null ? null : String(r.last_error),
      doneAt: r.done_at === null ? null : Number(r.done_at),
      outcome: r.outcome === null ? null : String(r.outcome),
    };
  }

  get(id: string) {
    const rows = this.sql.exec("SELECT * FROM fila WHERE id = ?", id).toArray();
    return rows.length ? this.toRow(rows[0]) : null;
  }

  insert(r: QueueRow) {
    this.sql.exec(
      `INSERT INTO fila (id, from_num, name, text, sent_at, simulated, options, state, received_at, seq, attempts, starts, not_before, last_error, done_at, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id, r.from, r.name, r.text, r.sentAt, r.simulated ? 1 : 0, JSON.stringify(r.options), r.state,
      r.receivedAt, r.seq, r.attempts, r.starts, r.notBefore, r.lastError, r.doneAt, r.outcome,
    );
  }

  update(id: string, p: Partial<QueueRow>) {
    const map: Record<string, unknown> = {};
    if (p.state !== undefined) map.state = p.state;
    if (p.text !== undefined) map.text = p.text;
    if (p.attempts !== undefined) map.attempts = p.attempts;
    if (p.starts !== undefined) map.starts = p.starts;
    if (p.notBefore !== undefined) map.not_before = p.notBefore;
    if ("lastError" in p) map.last_error = p.lastError ?? null;
    if ("doneAt" in p) map.done_at = p.doneAt ?? null;
    if ("outcome" in p) map.outcome = p.outcome ?? null;
    const cols = Object.keys(map);
    if (!cols.length) return;
    this.sql.exec(`UPDATE fila SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, ...cols.map((c) => map[c] as SqlStorageValue), id);
  }

  pending() {
    return this.sql.exec("SELECT * FROM fila WHERE state = 'pendiente' ORDER BY seq").toArray().map((r) => this.toRow(r));
  }

  nextSeq() {
    const r = this.sql.exec("SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM fila").one();
    return Number(r.s);
  }

  purgeDone(before: number) {
    this.sql.exec("DELETE FROM fila WHERE state = 'procesado' AND done_at < ?", before);
  }
}

export interface EnqueueRequest {
  from: string;
  name: string | null;
  text: string;
  messageId: string;
  sentAt: number | null;
  simulated: boolean;
  options: Record<string, string>;
  /** Esperar el resultado (simulación). En el webhook real se responde de inmediato. */
  wait: boolean;
  waitMs?: number;
}

export class ConversationQueue extends DurableObject<Env> {
  private queue: OrderedQueue;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage = new SqlQueueStorage(ctx.storage.sql);
    this.queue = new OrderedQueue(
      storage,
      { now: () => Date.now(), setAlarm: (at) => void ctx.storage.setAlarm(at) },
      (batch, info) => this.process(batch, info.attempt, info.resume),
      async (id) => {
        // Segunda línea contra duplicados: el mensaje ya está en la base de datos.
        const store = createPostgresStore(this.env.HYPERDRIVE.connectionString);
        try {
          return await store.messageExists(id);
        } finally {
          ctx.waitUntil(store.end());
        }
      },
    );
  }

  /** Llega un mensaje (desde /simular hoy; desde el webhook de Meta en el futuro). */
  async enqueue(req: EnqueueRequest): Promise<unknown> {
    // Los datos de salud se ocultan ANTES de guardar el mensaje en la fila.
    const redacted = redactHealthData(req.text);
    const msg: QueueMessage = {
      id: req.messageId,
      from: req.from,
      name: req.name,
      text: redacted.text,
      sentAt: req.sentAt,
      simulated: req.simulated,
      options: { ...req.options, ...(redacted.removed ? { salud_oculta: "1" } : {}) },
    };
    const status = await this.queue.enqueue(msg);
    if (status !== "nuevo") return { duplicate: true, estado: status, messageIds: [req.messageId], replies: [] };
    if (!req.wait) return { estado: "en_cola" };
    return this.queue.waitFor(req.messageId, req.waitMs ?? 20_000);
  }

  /** Alarma: ráfaga lista o reintento pendiente. Los errores se manejan dentro (no se relanzan). */
  async alarm() {
    await this.queue.run();
  }

  /** Simulación: cierra la conversación abierta de este número (pasa por la misma fila). */
  async reset(from: string): Promise<{ ok: boolean }> {
    const store = createPostgresStore(this.env.HYPERDRIVE.connectionString);
    try {
      await store.closeOpenConversation(from);
      return { ok: true };
    } finally {
      this.ctx.waitUntil(store.end());
    }
  }

  private async process(batch: QueueMessage[], attempt: number, resume: boolean) {
    const opts = batch[0].options;
    // Falla simulada SOLO en el primer intento (para probar la recuperación).
    if (attempt === 0 && batch.some((m) => m.options.simular_fallo === "1"))
      throw new AiError("Fallo simulado para la prueba de recuperación.", "failed");
    const models =
      opts.modelo === "prueba"
        ? singleModel(fakeModel())
        : createWorkersAiRouter(this.env.AI, { modelOverride: this.env.WORKERS_AI_MODEL, sink: consoleUsageSink });
    const store = createPostgresStore(this.env.HYPERDRIVE.connectionString);
    try {
      return await withTimeout(
        handleIncomingBatch(
          {
            store,
            models,
            // Solo los mensajes que llegaron por el webhook real se responden por WhatsApp real.
            sender: batch.every((m) => !m.simulated && m.options.canal === "meta")
              ? createCloudSender({
                  accessToken: this.env.WHATSAPP_ACCESS_TOKEN ?? "",
                  phoneNumberId: this.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
                  graphVersion: this.env.WHATSAPP_GRAPH_VERSION || "v23.0",
                })
              : simulatedSender,
            defaultAdvisorId: this.env.DEFAULT_ADVISOR_ID?.trim() || null,
            siteUrl: this.env.SITE_URL,
          },
          batch.map((m) => ({
            from: m.from,
            name: m.name,
            text: m.text,
            messageId: m.id,
            simulated: m.simulated,
            healthRedacted: m.options.salud_oculta === "1",
            referralAdvisorId: m.options.asesor ?? null,
            fromBusiness: m.options.eco === "1",
            messageType: (m.options.tipo as Incoming["messageType"]) ?? "texto",
          })),
          { resume },
        ),
        BATCH_TIMEOUT_MS,
      );
    } finally {
      this.ctx.waitUntil(store.end());
    }
  }
}
