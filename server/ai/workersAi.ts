import "server-only";

/**
 * PROVEEDOR DE IA: Cloudflare Workers AI
 * ──────────────────────────────────────
 * Se usa el binding `AI` de wrangler.jsonc (env.AI): no hay claves que guardar.
 * - En Cloudflare existe automáticamente.
 * - En `next dev` lo entrega initOpenNextCloudflareForDev() (next.config.ts) y se ejecuta
 *   en la cuenta de Cloudflare con la sesión de `wrangler login` (consume del mismo cupo).
 * - En Vercel no existe: el asesor virtual no se muestra.
 *
 * Para cambiar de proveedor en el futuro basta con otra implementación de `LanguageModel`.
 */

/** Modelo por defecto: buen español, contexto de 24.000 tokens y salida JSON garantizada (JSON Mode). */
export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TIMEOUT_MS = 20_000;

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LanguageModel {
  /** Devuelve un objeto que cumple `schema` (JSON Schema). */
  generateJson(messages: ModelMessage[], schema: object, maxTokens: number): Promise<unknown>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "unavailable" | "busy" | "failed",
  ) {
    super(message);
  }
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Binding de Workers AI, o null si no existe (Vercel, o local sin wrangler). */
async function getAiBinding(): Promise<AiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    // En producción solo existe dentro de Cloudflare (contexto síncrono). El modo asíncrono, que levanta
    // wrangler, se usa únicamente en desarrollo: así en Vercel no se intenta conectar a nada.
    const { env } =
      process.env.NODE_ENV === "production" ? getCloudflareContext() : await getCloudflareContext({ async: true });
    const ai = (env as unknown as Record<string, unknown>).AI as AiBinding | undefined;
    return ai && typeof ai.run === "function" ? ai : null;
  } catch {
    return null;
  }
}

export async function isWorkersAiAvailable(): Promise<boolean> {
  return (await getAiBinding()) !== null;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AiError("Tiempo de espera agotado.", "busy")), TIMEOUT_MS),
    ),
  ]);
}

/** Extrae el objeto JSON de la respuesta (según el modelo llega como objeto o como texto). */
function parseJson(raw: unknown): unknown {
  // Formatos de Workers AI: { response } o, en modelos nuevos, { choices: [{ message: { content } }] }.
  const r = raw as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
  const value = r?.response ?? r?.choices?.[0]?.message?.content ?? raw;
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new AiError("Respuesta vacía del modelo.", "failed");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("La respuesta del modelo no es JSON.", "failed");
  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch {
    throw new AiError("La respuesta del modelo no es JSON válido.", "failed");
  }
}

export async function getLanguageModel(): Promise<LanguageModel | null> {
  const ai = await getAiBinding();
  if (!ai) return null;
  const binding: AiBinding = ai;
  const model = process.env.WORKERS_AI_MODEL?.trim() || DEFAULT_MODEL;

  async function attempt(messages: ModelMessage[], schema: object, maxTokens: number): Promise<unknown> {
    let raw: unknown;
    try {
      raw = await withTimeout(
        binding.run(model, {
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
          response_format: { type: "json_schema", json_schema: schema },
        }),
      );
    } catch (error) {
      if (error instanceof AiError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      // Se registra en el servidor; al visitante nunca se le muestra el detalle.
      console.error(`[workers-ai] ${model}: ${message.slice(0, 300)}`);
      // Límite diario gratuito agotado, exceso de peticiones o capacidad temporal.
      if (/limit|quota|neuron|capacity|429|3036|3040|4006/i.test(message)) throw new AiError(message, "busy");
      throw new AiError(message, "failed");
    }
    try {
      return parseJson(raw);
    } catch (error) {
      console.error(`[workers-ai] JSON no válido: ${JSON.stringify(raw).slice(0, 300)}`);
      throw error;
    }
  }

  return {
    async generateJson(messages, schema, maxTokens) {
      try {
        return await attempt(messages, schema, maxTokens);
      } catch (error) {
        // Un reintento ante respuestas mal formadas o fallos puntuales (no si es límite de uso).
        if (error instanceof AiError && error.kind === "busy") throw error;
        return attempt(messages, schema, maxTokens);
      }
    },
  };
}
