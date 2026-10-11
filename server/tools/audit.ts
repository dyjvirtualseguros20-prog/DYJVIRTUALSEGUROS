/**
 * AUDITORÍA (tabla public.audit_events, migración 0009)
 * ─────────────────────────────────────────────────────
 * Cada acción que pasa por el ToolRunner deja UN evento: quién (actor), qué (acción y nivel),
 * sobre qué (recurso), cuándo y con qué resultado (éxito, denegado, error, duplicado o
 * propuesto). La tabla es de solo inserción: nadie puede modificar ni borrar eventos.
 *
 * Nunca se guarda contenido sensible completo: ni mensajes, ni teléfonos, correos, documentos,
 * placas o notas. Los metadatos pasan por `safeMetadata` (lista blanca de tipos y tamaño).
 *
 * Sin dependencias de Next.js ni de Cloudflare: lo usan la web (/admin) y el Worker de WhatsApp.
 */

export const TOOL_LEVELS = ["leer", "proponer", "ejecutar", "escalar"] as const;
export type ToolLevel = (typeof TOOL_LEVELS)[number];

export const ACTOR_TYPES = ["ia", "admin", "asesor", "sistema", "canal"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export type AuditOutcome = "exito" | "denegado" | "error" | "duplicado" | "propuesto";
export type AuditChannel = "web" | "whatsapp" | "admin" | "sistema";

export interface AuditEvent {
  actorType: ActorType;
  /** Usuario de staff (uuid), "asesor-virtual" (IA) o el canal/sistema. */
  actorId: string;
  channel: AuditChannel;
  action: string;
  level: ToolLevel;
  resourceType: string | null;
  resourceId: string | null;
  outcome: AuditOutcome;
  /** Código corto del motivo de una denegación o error (p. ej. "sin_acceso"). */
  reason: string | null;
  /** Mensaje técnico del error, recortado. */
  errorMessage: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
}

/** Dónde se escriben los eventos (Supabase en producción, memoria en las pruebas). */
export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

/* ───────────────────────── Metadatos sin datos sensibles ───────────────────────── */

/** Claves que NUNCA se guardan en la auditoría, aunque una herramienta las incluya por error. */
const SENSITIVE_KEY =
  /(body|text|texto|mensaje|message|phone|telefono|celular|whatsapp|email|correo|identif|document|cedula|placa|plate|name|nombre|notes|notas|address|direccion|birth|nacimiento|salud|health|form|lead|draft|password|token|secret)/i;

const MAX_STRING = 120;
const MAX_KEYS = 20;

/**
 * Copia segura de los metadatos: solo números, booleanos, textos cortos y listas cortas de
 * textos; descarta claves sensibles y objetos anidados. Así un error en una herramienta no
 * puede filtrar datos personales a la auditoría.
 */
export function safeMetadata(input: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, MAX_STRING);
    else if (Array.isArray(value) && value.every((v) => typeof v === "string"))
      out[key] = value.slice(0, 10).map((v) => v.slice(0, 40));
  }
  return out;
}

/** Mensaje de error apto para la auditoría (recortado y sin saltos de línea). */
export function safeErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").slice(0, 300);
}

/* ─────────────────────────────── Memoria (pruebas) ─────────────────────────────── */

export function memoryAuditSink(): AuditSink & { events: AuditEvent[]; failNext(): void } {
  const events: AuditEvent[] = [];
  let fail = false;
  return {
    events,
    failNext() {
      fail = true;
    },
    async write(event) {
      if (fail) {
        fail = false;
        throw new Error("Auditoría no disponible (simulado)");
      }
      events.push(structuredClone(event));
    },
  };
}
