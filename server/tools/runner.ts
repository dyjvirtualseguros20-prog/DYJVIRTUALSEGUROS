/**
 * TOOLRUNNER — la única puerta para que la IA (y el panel) cambien datos
 * ──────────────────────────────────────────────────────────────────────
 *   run(herramienta, actor, entrada, { idempotencyKey })
 *     1. actor permitido y activo            → si no: DENEGADO (actor_no_permitido / actor_inactivo)
 *     2. política (código + tool_policies)    → desactivada: DENEGADO · requiere humano y el actor
 *                                               es la IA o el sistema: PROPUESTO (no se ejecuta)
 *     3. entrada válida (Zod)                 → si no: DENEGADO (entrada_invalida)
 *     4. autorización propia de la herramienta (consentimiento, alcance del asesor…)
 *     5. idempotencia (si hay clave)          → ya hecha: DUPLICADO (devuelve el resultado anterior)
 *     6. ejecutar                             → ÉXITO · o ERROR (se registra y se libera la clave)
 *   Cada paso termina en UN evento de auditoría (audit.ts).
 *
 * El ToolRunner NO da permisos nuevos: ejecuta con el mismo acceso de quien lo llama (la sesión
 * del asesor con RLS en /admin, el rol wa_bot en el Worker). Un asesor no puede saltarse RLS.
 *
 * Niveles: LEER · PROPONER · EJECUTAR · ESCALAR. En esta etapa la IA solo ejecuta lo que ya hacía
 * (registrar la solicitud con ACEPTO, actualizar su conversación y escalar a una persona).
 */
import type { z } from "zod";
import {
  type ActorType,
  type AuditChannel,
  type AuditEvent,
  type AuditOutcome,
  type AuditSink,
  safeErrorMessage,
  safeMetadata,
  type ToolLevel,
} from "./audit";

export interface Actor {
  type: ActorType;
  /** Usuario de staff (uuid) o identificador fijo de la IA, el sistema o el canal. */
  id: string;
  channel: AuditChannel;
  /** Solo staff: la cuenta está activa (lo verifica también la base de datos). */
  active: boolean;
  /** Solo asesor: su advisor_id. */
  advisorId?: string | null;
}

export interface ToolContext<Deps> {
  actor: Actor;
  deps: Deps;
}

export interface ToolDefinition<Input, Output, Deps> {
  /** "recurso.accion", p. ej. "solicitud.registrar". */
  name: string;
  level: ToolLevel;
  /** Quién puede usarla. */
  actors: readonly ActorType[];
  /** Acción delicada: la IA y el sistema solo pueden PROPONERLA; la ejecuta una persona. */
  requiresHuman?: boolean;
  input: z.ZodType<Input>;
  /** Recurso afectado (para la auditoría). */
  resource(input: Input): { type: string; id: string | null };
  /** Autorización propia: devuelve el motivo de la denegación, o null si puede seguir. */
  authorize?(ctx: ToolContext<Deps>, input: Input): Promise<string | null> | string | null;
  /** Ejecuta. Devolver `{ denied }` cuando el recurso no existe o no es accesible (p. ej. RLS → 0 filas). */
  execute(ctx: ToolContext<Deps>, input: Input): Promise<Output | { denied: string }>;
  /** Metadatos para la auditoría (pasan por safeMetadata: nunca datos personales). */
  summarize?(input: Input, output?: Output): Record<string, unknown>;
}

/** Ajustes de la tabla tool_policies: solo pueden hacer la política MÁS estricta. */
export interface PolicyOverride {
  enabled: boolean;
  requiresHuman: boolean;
}

export interface PolicySource {
  get(action: string): Promise<PolicyOverride | null>;
}

export type ClaimResult = { state: "claimed" } | { state: "done"; result: unknown } | { state: "busy" };

/** Reserva de claves de idempotencia (tabla tool_idempotency en el Worker; memoria en pruebas). */
export interface IdempotencyStore {
  claim(key: string, action: string): Promise<ClaimResult>;
  complete(key: string, result: unknown): Promise<void>;
  release(key: string): Promise<void>;
}

export interface ProposalSink {
  propose(p: {
    action: string;
    actor: Actor;
    resourceType: string;
    resourceId: string | null;
    payload: Record<string, unknown>;
    idempotencyKey: string | null;
  }): Promise<void>;
}

export type ToolResult<Output> =
  | { status: "ok"; data: Output; auditFailed?: boolean }
  | { status: "duplicado"; data: unknown; auditFailed?: boolean }
  | { status: "denegado"; reason: string; auditFailed?: boolean }
  | { status: "propuesto"; auditFailed?: boolean }
  | { status: "error"; error: unknown; auditFailed?: boolean };

export interface RunnerDeps {
  audit: AuditSink;
  policies?: PolicySource;
  idempotency?: IdempotencyStore;
  proposals?: ProposalSink;
}

export interface RunOptions {
  idempotencyKey?: string | null;
}

const STAFF: readonly ActorType[] = ["admin", "asesor"];

export function createToolRunner(runner: RunnerDeps) {
  async function run<Input, Output, Deps>(
    tool: ToolDefinition<Input, Output, Deps>,
    actor: Actor,
    deps: Deps,
    rawInput: unknown,
    options: RunOptions = {},
  ): Promise<ToolResult<Output>> {
    const key = options.idempotencyKey ?? null;
    const parsed = tool.input.safeParse(rawInput);
    const resource = parsed.success ? tool.resource(parsed.data) : { type: tool.name.split(".")[0], id: null };

    const record = async (
      outcome: AuditOutcome,
      extra: { reason?: string; error?: unknown; metadata?: Record<string, unknown> } = {},
    ): Promise<boolean> => {
      const event: AuditEvent = {
        actorType: actor.type,
        actorId: actor.id.slice(0, 120),
        channel: actor.channel,
        action: tool.name,
        level: tool.level,
        resourceType: resource.type,
        resourceId: resource.id,
        outcome,
        reason: extra.reason ?? null,
        errorMessage: extra.error === undefined ? null : safeErrorMessage(extra.error),
        idempotencyKey: key,
        metadata: safeMetadata(extra.metadata),
      };
      try {
        await runner.audit.write(event);
        return true;
      } catch (error) {
        // La acción ya ocurrió (o se rechazó): no se deshace, pero queda en el registro del servidor.
        console.error("[auditoria] no se pudo registrar el evento", tool.name, outcome, safeErrorMessage(error));
        return false;
      }
    };
    const deny = async (reason: string): Promise<ToolResult<Output>> => ({
      status: "denegado",
      reason,
      auditFailed: !(await record("denegado", { reason })),
    });

    // 1. Actor
    if (!tool.actors.includes(actor.type)) return deny("actor_no_permitido");
    if (STAFF.includes(actor.type) && !actor.active) return deny("actor_inactivo");
    if (actor.type === "asesor" && !actor.advisorId) return deny("asesor_sin_advisor_id");

    // 2. Política: la del código, endurecida (nunca relajada) por tool_policies.
    let override: PolicyOverride | null = null;
    try {
      override = runner.policies ? await runner.policies.get(tool.name) : null;
    } catch (error) {
      // Sin poder leer la política no se actúa (falla cerrado); en el Worker la fila reintenta.
      return {
        status: "error",
        error,
        auditFailed: !(await record("error", { error, reason: "politica_no_disponible" })),
      };
    }
    if (override && !override.enabled) return deny("accion_desactivada");
    const requiresHuman = Boolean(tool.requiresHuman || override?.requiresHuman);

    // 3. Entrada
    if (!parsed.success) return deny("entrada_invalida");
    const input = parsed.data;
    const metadata = tool.summarize?.(input);

    if (requiresHuman && (actor.type === "ia" || actor.type === "sistema" || actor.type === "canal")) {
      if (!runner.proposals) return deny("requiere_humano");
      try {
        await runner.proposals.propose({
          action: tool.name,
          actor,
          resourceType: resource.type,
          resourceId: resource.id,
          payload: safeMetadata(metadata),
          idempotencyKey: key,
        });
      } catch (error) {
        return {
          status: "error",
          error,
          auditFailed: !(await record("error", { error, reason: "propuesta_fallida" })),
        };
      }
      return { status: "propuesto", auditFailed: !(await record("propuesto", { metadata })) };
    }

    // 4. Autorización propia
    const ctx: ToolContext<Deps> = { actor, deps };
    const denied = await tool.authorize?.(ctx, input);
    if (denied) return deny(denied);

    // 5. Idempotencia
    if (key) {
      if (!runner.idempotency) return deny("idempotencia_no_disponible");
      let claim: ClaimResult;
      try {
        claim = await runner.idempotency.claim(key, tool.name);
      } catch (error) {
        return {
          status: "error",
          error,
          auditFailed: !(await record("error", { error, reason: "idempotencia_fallida" })),
        };
      }
      if (claim.state === "done")
        return { status: "duplicado", data: claim.result, auditFailed: !(await record("duplicado", { metadata })) };
      if (claim.state === "busy") return deny("en_curso");
    }

    // 6. Ejecutar
    try {
      const output = await tool.execute(ctx, input);
      if (output && typeof output === "object" && "denied" in output) {
        if (key) await runner.idempotency!.release(key);
        return deny((output as { denied: string }).denied);
      }
      if (key) await runner.idempotency!.complete(key, output ?? null);
      const data = output as Output;
      return { status: "ok", data, auditFailed: !(await record("exito", { metadata: tool.summarize?.(input, data) })) };
    } catch (error) {
      if (key) await runner.idempotency!.release(key).catch(() => undefined);
      return { status: "error", error, auditFailed: !(await record("error", { error, metadata })) };
    }
  }

  /** Como run(), pero un error se vuelve a lanzar (la fila del Worker lo reintenta). */
  async function runOrThrow<Input, Output, Deps>(
    tool: ToolDefinition<Input, Output, Deps>,
    actor: Actor,
    deps: Deps,
    input: unknown,
    options?: RunOptions,
  ): Promise<Exclude<ToolResult<Output>, { status: "error" }>> {
    const result = await run(tool, actor, deps, input, options);
    if (result.status === "error") throw result.error;
    return result;
  }

  return { run, runOrThrow };
}

export type ToolRunner = ReturnType<typeof createToolRunner>;

/* ─────────────────────────────── Memoria (pruebas) ─────────────────────────────── */

export function memoryIdempotencyStore(): IdempotencyStore & {
  entries: Map<string, { status: string; result: unknown }>;
} {
  const entries = new Map<string, { status: string; result: unknown }>();
  return {
    entries,
    async claim(key) {
      const e = entries.get(key);
      if (e?.status === "completado") return { state: "done", result: e.result };
      if (e?.status === "en_curso") return { state: "busy" };
      entries.set(key, { status: "en_curso", result: null });
      return { state: "claimed" };
    },
    async complete(key, result) {
      entries.set(key, { status: "completado", result });
    },
    async release(key) {
      entries.set(key, { status: "fallido", result: null });
    },
  };
}

export function memoryProposalSink(): ProposalSink & { proposals: Array<Parameters<ProposalSink["propose"]>[0]> } {
  const proposals: Array<Parameters<ProposalSink["propose"]>[0]> = [];
  return {
    proposals,
    async propose(p) {
      if (p.idempotencyKey && proposals.some((x) => x.idempotencyKey === p.idempotencyKey)) return;
      proposals.push(structuredClone(p));
    },
  };
}

export function staticPolicies(overrides: Record<string, PolicyOverride>): PolicySource {
  return { get: async (action) => overrides[action] ?? null };
}
