import "server-only";

/**
 * PROVEEDOR DE IA DE LA WEB: Cloudflare Workers AI
 * ────────────────────────────────────────────────
 * Se usa el binding `AI` de wrangler.jsonc (env.AI): no hay claves que guardar.
 * - En Cloudflare existe automáticamente.
 * - En `next dev` lo entrega initOpenNextCloudflareForDev() (next.config.ts) y se ejecuta
 *   en la cuenta de Cloudflare con la sesión de `wrangler login` (consume del mismo cupo).
 * - En Vercel no existe: el asesor virtual no se muestra.
 *
 * La lógica del modelo está en server/ai/model.ts (compartida con el Worker de WhatsApp);
 * aquí solo se obtiene el binding a través de OpenNext.
 */
import { type AiBinding, createWorkersAiModel, type LanguageModel } from "./model";

export { AiError, DEFAULT_MODEL, type LanguageModel, type ModelMessage } from "./model";

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

export async function getLanguageModel(): Promise<LanguageModel | null> {
  const ai = await getAiBinding();
  return ai ? createWorkersAiModel(ai, process.env.WORKERS_AI_MODEL) : null;
}
