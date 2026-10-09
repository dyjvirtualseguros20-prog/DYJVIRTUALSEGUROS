/**
 * FILA ORDENADA POR CLIENTE (lógica pura, sin Cloudflare)
 * ───────────────────────────────────────────────────────
 * Una instancia por número de WhatsApp (en producción vive dentro de un Durable Object:
 * queue-do.ts). Garantiza:
 *   - UN solo lote en proceso a la vez por cliente (nunca dos turnos simultáneos);
 *   - ORDEN: por la hora del mensaje (Meta / simulación) y, si empata o no existe, por llegada;
 *   - RÁFAGAS: espera DEBOUNCE_MS sin mensajes nuevos (máximo MAX_WAIT_MS desde el primero)
 *     y procesa todos los pendientes juntos;
 *   - IDEMPOTENCIA: un ID ya pendiente o ya procesado no vuelve a entrar;
 *   - FALLOS: si el lote falla, los mensajes SIGUEN pendientes (no se marcan como procesados)
 *     y se reintentan con espera creciente; tras MAX_ATTEMPTS quedan como "fallido" para revisión
 *     humana. Nunca se inventa una respuesta para tapar un error.
 *   - REINICIO: todo el estado vive en el almacenamiento (SQLite del Durable Object): si el
 *     objeto se reinicia, los pendientes se retoman con la siguiente alarma.
 */

/** Espera sin mensajes nuevos antes de procesar una ráfaga. */
export const DEBOUNCE_MS = 2500;
/** Espera máxima desde el primer mensaje pendiente (un cliente que escribe sin parar no bloquea). */
export const MAX_WAIT_MS = 8000;
/** Esperas entre reintentos de un lote fallido. */
export const RETRY_DELAYS_MS = [3000, 10000, 30000, 60000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** Cuánto se recuerdan los IDs ya procesados (protección extra contra reintentos de Meta). */
export const DONE_RETENTION_MS = 7 * 24 * 3600 * 1000;

export interface QueueMessage {
  id: string;
  from: string;
  name: string | null;
  text: string;
  /** Hora del mensaje según el origen (ms). null si no se conoce. */
  sentAt: number | null;
  simulated: boolean;
  /** Opciones de la simulación (p. ej. modelo de prueba). */
  options: Record<string, string>;
}

export type QueueState = "pendiente" | "procesado" | "fallido";

export interface QueueRow extends QueueMessage {
  state: QueueState;
  /** Llegada a la fila (ms) y orden de llegada. */
  receivedAt: number;
  seq: number;
  attempts: number;
  /**
   * Veces que un lote con este mensaje EMPEZÓ a procesarse. Si es > 0 y sigue pendiente, el
   * proceso anterior se interrumpió (error o reinicio del objeto): se retoma como continuación.
   */
  starts: number;
  /** No antes de esta hora (reintentos). */
  notBefore: number;
  lastError: string | null;
  doneAt: number | null;
  /** Reservado (no se guarda el resultado: quien espera lo recibe en memoria). */
  outcome: string | null;
}

/** Almacenamiento síncrono (SQLite del Durable Object o memoria en las pruebas). */
export interface QueueStorage {
  get(id: string): QueueRow | null;
  insert(row: QueueRow): void;
  update(id: string, patch: Partial<QueueRow>): void;
  pending(): QueueRow[];
  nextSeq(): number;
  purgeDone(before: number): void;
}

export interface QueueHost {
  now(): number;
  /** Programa (o reprograma) la próxima ejecución. Una sola alarma: la última reemplaza a la anterior. */
  setAlarm(at: number): void;
}

export interface BatchInfo {
  attempt: number;
  /** Algún mensaje del lote ya había empezado a procesarse: continuar lo que quedó a medias. */
  resume: boolean;
}

/** Procesa un lote ordenado. Si lanza error, el lote se reintenta. */
export type BatchProcessor = (batch: QueueMessage[], info: BatchInfo) => Promise<unknown>;

export type EnqueueStatus = "nuevo" | "duplicado_pendiente" | "duplicado_procesado" | "duplicado_fallido";

const order = (a: QueueRow, b: QueueRow) => (a.sentAt ?? a.receivedAt) - (b.sentAt ?? b.receivedAt) || a.seq - b.seq;

export class OrderedQueue {
  private running: Promise<void> | null = null;
  private waiters = new Map<string, Array<(outcome: unknown) => void>>();

  constructor(
    private storage: QueueStorage,
    private host: QueueHost,
    private processor: BatchProcessor,
    /** Comprobación externa de duplicados (p. ej. el mensaje ya está en la base de datos). */
    private alreadyStored: (id: string) => Promise<boolean> = async () => false,
  ) {}

  /** Agrega un mensaje. No procesa: programa la alarma de la ráfaga. */
  async enqueue(msg: QueueMessage): Promise<EnqueueStatus> {
    const existing = this.storage.get(msg.id);
    if (existing) {
      if (existing.state === "pendiente") return "duplicado_pendiente";
      return existing.state === "procesado" ? "duplicado_procesado" : "duplicado_fallido";
    }
    if (await this.alreadyStored(msg.id)) return "duplicado_procesado";
    // Otra llamada pudo insertarlo mientras se consultaba la base de datos.
    if (this.storage.get(msg.id)) return "duplicado_pendiente";
    const now = this.host.now();
    this.storage.insert({
      ...msg,
      state: "pendiente",
      receivedAt: now,
      seq: this.storage.nextSeq(),
      attempts: 0,
      starts: 0,
      notBefore: 0,
      lastError: null,
      doneAt: null,
      outcome: null,
    });
    this.schedule();
    return "nuevo";
  }

  /** Espera el resultado del lote que incluya este mensaje (para la simulación). */
  waitFor(id: string, timeoutMs: number): Promise<unknown> {
    const row = this.storage.get(id);
    if (row && row.state !== "pendiente") return Promise.resolve({ estado: row.state });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.dropWaiter(id, done);
        resolve({ estado: "en_cola", mensaje: "El mensaje sigue en la fila; se procesará en orden." });
      }, timeoutMs);
      const done = (outcome: unknown) => {
        clearTimeout(timer);
        resolve(outcome);
      };
      this.waiters.set(id, [...(this.waiters.get(id) ?? []), done]);
    });
  }

  /** Cuándo debe ejecutarse el próximo lote (null = nada pendiente). */
  nextDue(): number | null {
    const pending = this.storage.pending();
    if (!pending.length) return null;
    // Si hay un lote fallido esperando reintento, NADA se adelanta: los mensajes nuevos esperan y se
    // procesan junto con él (así nunca se responde a un mensaje posterior antes que a uno anterior).
    const retry = pending.filter((r) => r.attempts > 0).map((r) => r.notBefore);
    if (retry.length) return Math.min(...retry);
    const first = Math.min(...pending.map((r) => r.receivedAt));
    const last = Math.max(...pending.map((r) => r.receivedAt));
    return Math.min(last + DEBOUNCE_MS, first + MAX_WAIT_MS);
  }

  /** Ejecución de la alarma. Nunca hay dos lotes a la vez: si ya hay uno en curso, se espera. */
  async run(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** ¿Hay un lote procesándose ahora? (pruebas y diagnóstico) */
  get busy(): boolean {
    return this.running !== null;
  }

  private async loop(): Promise<void> {
    for (;;) {
      const due = this.nextDue();
      if (due === null) return;
      if (due > this.host.now()) {
        this.host.setAlarm(due);
        return;
      }
      // Lote = TODOS los pendientes, en orden. Lo que llegue durante el proceso irá al siguiente lote.
      const batch = this.storage.pending().sort(order);
      if (!batch.length) {
        this.schedule();
        return;
      }
      const attempt = Math.max(...batch.map((r) => r.attempts));
      const resume = batch.some((r) => r.starts > 0);
      // Se anota el inicio ANTES de procesar: si el objeto se reinicia a mitad, el lote se retoma.
      for (const r of batch) this.storage.update(r.id, { starts: r.starts + 1 });
      try {
        const outcome = await this.processor(
          batch.map((r) => this.toMessage(r)),
          { attempt, resume },
        );
        const doneAt = this.host.now();
        // Procesado: el texto ya está en la base de datos (fuente de verdad). En la fila solo queda
        // el ID (para reconocer duplicados), sin el contenido del mensaje.
        for (const r of batch) this.storage.update(r.id, { state: "procesado", doneAt, text: "", outcome: null, lastError: null });
        for (const r of batch) this.resolve(r.id, outcome);
        this.storage.purgeDone(doneAt - DONE_RETENTION_MS);
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
        const next = attempt + 1;
        if (next >= MAX_ATTEMPTS) {
          // Sin más reintentos: queda registrado como fallido para revisión humana (no se responde nada inventado).
          for (const r of batch) this.storage.update(r.id, { state: "fallido", attempts: next, lastError: message });
          for (const r of batch) this.resolve(r.id, { estado: "fallido", error: "No se pudo procesar el mensaje." });
        } else {
          const notBefore = this.host.now() + RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
          for (const r of batch) this.storage.update(r.id, { attempts: next, notBefore, lastError: message });
        }
      }
    }
  }

  private schedule() {
    const due = this.nextDue();
    if (due !== null) this.host.setAlarm(due);
  }

  private toMessage(r: QueueRow): QueueMessage {
    return { id: r.id, from: r.from, name: r.name, text: r.text, sentAt: r.sentAt, simulated: r.simulated, options: r.options };
  }

  private resolve(id: string, outcome: unknown) {
    for (const done of this.waiters.get(id) ?? []) done(outcome);
    this.waiters.delete(id);
  }

  private dropWaiter(id: string, fn: (o: unknown) => void) {
    const rest = (this.waiters.get(id) ?? []).filter((w) => w !== fn);
    if (rest.length) this.waiters.set(id, rest);
    else this.waiters.delete(id);
  }
}

/** Almacenamiento en memoria (pruebas). Persistir el objeto entre "reinicios" simula el SQLite del DO. */
export function memoryQueueStorage(): QueueStorage & { rows: Map<string, QueueRow> } {
  const rows = new Map<string, QueueRow>();
  let seq = 0;
  return {
    rows,
    get: (id) => (rows.has(id) ? { ...rows.get(id)! } : null),
    insert: (row) => void rows.set(row.id, { ...row }),
    update: (id, patch) => {
      const r = rows.get(id);
      if (r) rows.set(id, { ...r, ...patch });
    },
    pending: () => [...rows.values()].filter((r) => r.state === "pendiente").map((r) => ({ ...r })),
    nextSeq: () => {
      seq = Math.max(seq, ...[...rows.values()].map((r) => r.seq)) + 1;
      return seq;
    },
    purgeDone: (before) => {
      for (const [id, r] of rows) if (r.state === "procesado" && (r.doneAt ?? 0) < before) rows.delete(id);
    },
  };
}
