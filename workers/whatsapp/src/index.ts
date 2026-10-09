/**
 * dyj-whatsapp — Súper Asesor D&J por WhatsApp (FASE DE SIMULACIÓN)
 * ─────────────────────────────────────────────────────────────────
 * Rutas:
 *   POST /simular            → procesa un mensaje simulado (requiere Authorization: Bearer <SIMULATION_KEY>)
 *   POST /simular/reiniciar  → cierra la conversación abierta de un número de prueba (misma clave)
 *   todo lo demás            → 404 (en esta fase NO existe /webhook: no se reciben ni envían mensajes reales)
 *
 * Usa el mismo núcleo que el chat de la web (server/assistant/core.ts) y las mismas tablas de Supabase.
 */
import { AiError } from "@/server/ai/model";
import { consoleUsageSink, createWorkersAiRouter, singleModel } from "@/server/ai/router";
import { handleIncoming } from "./conversation";
import type { Env } from "./env";
import { simulatedSender } from "./sender";
import { connectionTestModel } from "./testModel";
import { createPostgresStore } from "./store";
import { timingSafeEqual } from "./webhook";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const notFound = () => new Response("Not found", { status: 404 });

/** Tope de tiempo por mensaje: si la base de datos o la IA no responden, se corta con error (nunca queda colgado). */
const REQUEST_TIMEOUT_MS = 25_000;
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: number | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Tiempo de espera agotado al procesar el mensaje.")), REQUEST_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function authorized(req: Request, env: Env): boolean {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(env.SIMULATION_KEY) && key.length > 0 && timingSafeEqual(key, env.SIMULATION_KEY);
}

const worker = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method !== "POST" || !pathname.startsWith("/simular")) return notFound();
    // Sin clave válida la ruta "no existe": no se revela nada.
    if (!authorized(req, env)) return notFound();
    if (env.WHATSAPP_MODE !== "simulacion") return json({ error: "El Worker no está en modo simulación." }, 409);
    if (!env.HYPERDRIVE?.connectionString) return json({ error: "Falta la conexión a la base de datos (Hyperdrive)." }, 503);

    let body: { from?: unknown; name?: unknown; text?: unknown; messageId?: unknown; modelo?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "JSON no válido." }, 400);
    }
    const from = typeof body.from === "string" ? body.from.replace(/\D/g, "") : "";
    if (!/^[0-9]{8,15}$/.test(from)) return json({ error: "Número no válido." }, 400);

    const store = createPostgresStore(env.HYPERDRIVE.connectionString);
    try {
      if (pathname === "/simular/reiniciar") {
        await withTimeout(store.closeOpenConversation(from));
        return json({ ok: true });
      }
      if (pathname !== "/simular") return notFound();
      // "modelo": "prueba" → verificación de la conexión sin usar (ni gastar) Workers AI.
      // Si no, modelos por tarea con la configuración actual (todo Workers AI, mismo modelo).
      const models =
        body.modelo === "prueba"
          ? singleModel(connectionTestModel)
          : createWorkersAiRouter(env.AI, { modelOverride: env.WORKERS_AI_MODEL, sink: consoleUsageSink });
      const text = typeof body.text === "string" ? body.text : "";
      // Los IDs simulados siempre empiezan por "sim-" para no confundirse nunca con mensajes reales.
      const rawId = typeof body.messageId === "string" && body.messageId.trim() ? body.messageId.trim() : crypto.randomUUID();
      const messageId = `sim-${rawId.replace(/^sim-/, "")}`.slice(0, 200);
      const outcome = await withTimeout(
        handleIncoming(
          {
            store,
            models,
            sender: simulatedSender,
            defaultAdvisorId: env.DEFAULT_ADVISOR_ID?.trim() || null,
            siteUrl: env.SITE_URL,
          },
          { from, name: typeof body.name === "string" ? body.name : null, text, messageId, simulated: true },
        ),
      );
      return json(outcome);
    } catch (error) {
      // Al cliente de la simulación solo se le da el tipo de error; el detalle queda en los registros.
      const message = error instanceof Error ? error.message : String(error);
      console.error("[simular]", message.slice(0, 300));
      // Solo los errores de la IA (AiError "busy") son "IA ocupada"; el resto (p. ej. base de datos) es un error interno.
      const busy = error instanceof AiError && error.kind === "busy";
      return json({ error: busy ? "La IA está ocupada o sin cupo. Intenta más tarde." : "No se pudo procesar el mensaje." }, busy ? 503 : 500);
    } finally {
      ctx.waitUntil(store.end());
    }
  },
};

export default worker;
