/**
 * dyj-whatsapp — Súper Asesor D&J por WhatsApp
 * ────────────────────────────────────────────
 * Rutas:
 *   GET  /webhook            → verificación de Meta (WHATSAPP_VERIFY_TOKEN)
 *   POST /webhook            → eventos de WhatsApp Cloud API. Firma X-Hub-Signature-256 obligatoria
 *                              (WHATSAPP_APP_SECRET). Responde 200 enseguida: cada mensaje entra a la
 *                              FILA DEL CLIENTE (Durable Object) y se procesa allí (orden, ráfagas,
 *                              duplicados por wamid, reintentos). Solo en modo "piloto" o "produccion".
 *   POST /simular            → pruebas internas: mensaje simulado, nunca se envía por WhatsApp real
 *                              (Authorization: Bearer <SIMULATION_KEY>). Opciones: "modelo": "prueba"
 *                              (sin Workers AI), "asesor": "<id>", "simularFallo", "timestamp", "esperar".
 *   POST /simular/reiniciar  → cierra la conversación abierta de un número de prueba (misma clave)
 *   todo lo demás            → 404
 *
 * Modo piloto: la IA solo atiende los números de WHATSAPP_PILOT_NUMBERS. Los mensajes de cualquier
 * otro número se ignoran por completo (no se guardan ni se responden): los sigue atendiendo la persona
 * en la app WhatsApp Business (coexistencia).
 */
import type { Env } from "./env";
import { handleWebhook, pilotNumbers, timingSafeEqual } from "./webhook";

export { ConversationQueue } from "./queue-do";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const notFound = () => new Response("Not found", { status: 404 });

function authorized(req: Request, env: Env): boolean {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(env.SIMULATION_KEY) && key.length > 0 && timingSafeEqual(key, env.SIMULATION_KEY);
}

/** Fila del cliente: una por canal y número. */
const queueFor = (env: Env, from: string) =>
  env.CONVERSATION_QUEUE.get(env.CONVERSATION_QUEUE.idFromName(`whatsapp:${from}`));

const realMode = (env: Env) => env.WHATSAPP_MODE === "piloto" || env.WHATSAPP_MODE === "produccion";

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/webhook") {
      try {
        return await handleWebhook(req, env, (customer, msg) => queueFor(env, customer).enqueue(msg));
      } catch (error) {
        console.error("[webhook]", (error instanceof Error ? error.message : String(error)).slice(0, 200));
        return new Response("Error", { status: 500 });
      }
    }
    if (req.method !== "POST" || !pathname.startsWith("/simular")) return notFound();
    // Sin clave válida la ruta "no existe": no se revela nada.
    if (!authorized(req, env)) return notFound();
    if (!env.HYPERDRIVE?.connectionString)
      return json({ error: "Falta la conexión a la base de datos (Hyperdrive)." }, 503);

    let body: {
      from?: unknown;
      name?: unknown;
      text?: unknown;
      messageId?: unknown;
      modelo?: unknown;
      timestamp?: unknown;
      esperar?: unknown;
      simularFallo?: unknown;
      asesor?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "JSON no válido." }, 400);
    }
    const from = typeof body.from === "string" ? body.from.replace(/\D/g, "") : "";
    if (!/^[0-9]{8,15}$/.test(from)) return json({ error: "Número no válido." }, 400);
    // En modo real, el simulador no puede usar números del piloto (evita mezclar pruebas con WhatsApp real).
    if (realMode(env) && pilotNumbers(env.WHATSAPP_PILOT_NUMBERS).has(from))
      return json({ error: "Ese número es del piloto real: usa otro número de prueba." }, 409);

    try {
      if (pathname === "/simular/reiniciar") return json(await queueFor(env, from).reset(from));
      if (pathname !== "/simular") return notFound();

      const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
      if (!text.trim()) return json({ error: "Mensaje vacío." }, 400);
      // Los IDs simulados siempre empiezan por "sim-" para no confundirse nunca con mensajes reales.
      const rawId =
        typeof body.messageId === "string" && body.messageId.trim() ? body.messageId.trim() : crypto.randomUUID();
      const messageId = `sim-${rawId.replace(/^sim-/, "")}`.slice(0, 180);
      const options: Record<string, string> = {};
      if (body.modelo === "prueba") options.modelo = "prueba"; // modelo de simulación, sin Workers AI
      if (body.simularFallo === true) options.simular_fallo = "1"; // falla el primer intento (prueba de recuperación)
      // Atribución: el cliente llega desde el enlace de un asesor (solo se aplica si es de la base central).
      if (typeof body.asesor === "string" && /^[a-z0-9-]{1,30}$/.test(body.asesor)) options.asesor = body.asesor;
      const sentAt = typeof body.timestamp === "number" && Number.isFinite(body.timestamp) ? body.timestamp : null;

      const result = await queueFor(env, from).enqueue({
        from,
        name: typeof body.name === "string" ? body.name : null,
        text,
        messageId,
        sentAt,
        simulated: true,
        options,
        wait: body.esperar !== false,
      });
      return json(result);
    } catch (error) {
      // Al cliente de la simulación solo se le da el tipo de error; el detalle queda en los registros.
      console.error("[simular]", (error instanceof Error ? error.message : String(error)).slice(0, 300));
      return json({ error: "No se pudo procesar el mensaje." }, 500);
    }
  },
};

export default worker;
