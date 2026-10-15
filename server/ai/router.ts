/**
 * ENRUTADOR DE MODELOS POR TAREA (capa intercambiable de proveedores)
 * ───────────────────────────────────────────────────────────────────
 *   El Súper Asesor pide un modelo según la TAREA, nunca a un proveedor concreto:
 *
 *     models.forTask("razonamiento")  ─►  rutas: tarea → { proveedor, modelo }  ─►  proveedor.create(modelo)
 *
 *   Hoy TODAS las tareas van a Workers AI con el mismo modelo de siempre (defaultRoutes).
 *   Para usar otro proveedor en el futuro basta con:
 *     1. implementar un ModelProvider (p. ej. "otro-proveedor") que devuelva un LanguageModel;
 *     2. registrarlo en `providers` y cambiar la ruta de la tarea (p. ej. resumen → modelo económico).
 *   El núcleo del asistente no cambia.
 *
 *   Reglas:
 *   - Una tarea desconocida o una ruta hacia un proveedor no registrado es un ERROR (ModelRoutingError):
 *     nunca se elige otro proveedor "por si acaso".
 *   - Cada llamada se mide (tarea, proveedor, modelo, latencia, tokens si el proveedor los informa)
 *     y se entrega a un UsageSink. Si el proveedor no informa tokens, quedan en null.
 *   - Los errores del proveedor se propagan tal cual (mismo AiError que antes): el comportamiento
 *     seguro de cada canal no cambia.
 */
import {
  AiError,
  type AiBinding,
  createWorkersAiModel,
  DEFAULT_MODEL,
  type LanguageModel,
  type ModelHooks,
  type ModelUsage,
  WORKERS_AI_PROVIDER,
} from "./model";

/** Tipos de tarea. El turno de conversación del asistente usa "razonamiento". */
export const MODEL_TASKS = ["rapido", "razonamiento", "resumen", "extraccion"] as const;
export type ModelTask = (typeof MODEL_TASKS)[number];

export const isModelTask = (value: unknown): value is ModelTask =>
  typeof value === "string" && (MODEL_TASKS as readonly string[]).includes(value);

/** Un proveedor sabe crear un LanguageModel para un nombre de modelo. */
export interface ModelProvider {
  readonly id: string;
  create(model: string, hooks: ModelHooks): LanguageModel;
}

export interface TaskRoute {
  provider: string;
  model: string;
}

export type ModelRoutes = Record<ModelTask, TaskRoute>;

/** Registro de una llamada al modelo. */
export interface ModelUsageRecord {
  task: ModelTask;
  provider: string;
  model: string;
  latencyMs: number;
  ok: boolean;
  /** Tipo de error (AiError.kind) si la llamada falló. */
  errorKind: string | null;
  /** null = el proveedor no lo informó. */
  inputTokens: number | null;
  outputTokens: number | null;
  at: string;
}

export interface UsageSink {
  record(entry: ModelUsageRecord): void;
}

/** De dónde obtiene el núcleo un modelo para cada tarea. */
export interface ModelSource {
  forTask(task: ModelTask): LanguageModel;
}

export class ModelRoutingError extends Error {}

export interface ModelRouter extends ModelSource {
  /** Ruta configurada para una tarea (copia). */
  routeFor(task: ModelTask): TaskRoute;
}

export function createModelRouter(options: {
  providers: ModelProvider[];
  routes: ModelRoutes;
  sink?: UsageSink;
}): ModelRouter {
  const { providers, routes, sink } = options;
  const byId = new Map(providers.map((p) => [p.id, p]));

  // La configuración se valida completa al crear el enrutador: un error de configuración
  // se detecta de inmediato y no en mitad de una conversación.
  for (const key of Object.keys(routes)) {
    if (!isModelTask(key)) throw new ModelRoutingError(`Tarea de modelo desconocida en la configuración: "${key}"`);
  }
  for (const task of MODEL_TASKS) {
    const route = routes[task];
    if (!route?.provider || !route?.model) throw new ModelRoutingError(`Falta la ruta de la tarea "${task}"`);
    if (!byId.has(route.provider))
      throw new ModelRoutingError(`La tarea "${task}" apunta a un proveedor no registrado: "${route.provider}"`);
  }

  const routeFor = (task: ModelTask): TaskRoute => {
    if (!isModelTask(task)) throw new ModelRoutingError(`Tarea de modelo desconocida: "${String(task)}"`);
    return { ...routes[task] };
  };

  const record = (entry: ModelUsageRecord) => {
    try {
      sink?.record(entry);
    } catch {
      // La medición nunca debe romper una respuesta.
    }
  };

  return {
    routeFor,
    forTask(task) {
      const route = routeFor(task);
      const provider = byId.get(route.provider)!;
      return {
        async generateJson(messages, schema, maxTokens) {
          let usage: ModelUsage = { inputTokens: null, outputTokens: null };
          // Un modelo por llamada: el uso informado no se mezcla entre llamadas simultáneas.
          const model = provider.create(route.model, { onUsage: (u) => (usage = u) });
          const started = Date.now();
          const base = { task, provider: route.provider, model: route.model };
          try {
            const output = await model.generateJson(messages, schema, maxTokens);
            record({ ...base, latencyMs: Date.now() - started, ok: true, errorKind: null, ...usage, at: new Date().toISOString() });
            return output;
          } catch (error) {
            record({
              ...base,
              latencyMs: Date.now() - started,
              ok: false,
              errorKind: error instanceof AiError ? error.kind : "failed",
              ...usage,
              at: new Date().toISOString(),
            });
            throw error;
          }
        },
      };
    },
  };
}

/* ─────────────────────────── Configuración actual ─────────────────────────── */

/** Proveedor Workers AI sobre un binding `AI` (el único conectado hoy). */
export function workersAiProvider(binding: AiBinding): ModelProvider {
  return { id: WORKERS_AI_PROVIDER, create: (model, hooks) => createWorkersAiModel(binding, model, hooks) };
}

/** Rutas actuales: todas las tareas → Workers AI con el mismo modelo (comportamiento sin cambios). */
export function defaultRoutes(model: string = DEFAULT_MODEL): ModelRoutes {
  const route = { provider: WORKERS_AI_PROVIDER, model };
  return { rapido: { ...route }, razonamiento: { ...route }, resumen: { ...route }, extraccion: { ...route } };
}

/** Enrutador con la configuración actual. `modelOverride` = variable WORKERS_AI_MODEL (igual que antes). */
export function createWorkersAiRouter(binding: AiBinding, options: { modelOverride?: string; sink?: UsageSink } = {}) {
  return createModelRouter({
    providers: [workersAiProvider(binding)],
    routes: defaultRoutes(options.modelOverride?.trim() || DEFAULT_MODEL),
    sink: options.sink,
  });
}

/* ─────────────────────────── Utilidades ─────────────────────────── */

/** Un solo modelo para todas las tareas (pruebas y modelos de prueba de conexión). */
export function singleModel(model: LanguageModel): ModelSource {
  return {
    forTask(task) {
      if (!isModelTask(task)) throw new ModelRoutingError(`Tarea de modelo desconocida: "${String(task)}"`);
      return model;
    },
  };
}

/** Registro de uso en memoria (últimas `limit` llamadas). No persiste nada. */
export function memoryUsageSink(limit = 200): UsageSink & { entries(): ModelUsageRecord[] } {
  const entries: ModelUsageRecord[] = [];
  return {
    record(entry) {
      entries.push(entry);
      if (entries.length > limit) entries.shift();
    },
    entries: () => [...entries],
  };
}

/** Registro de uso en los logs del Worker (una línea por llamada, sin contenido de mensajes). */
export const consoleUsageSink: UsageSink = {
  record(entry) {
    console.log(`[ia-uso] ${JSON.stringify(entry)}`);
  },
};
