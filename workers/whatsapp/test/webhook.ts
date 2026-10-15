/**
 * PRUEBAS DEL CANAL REAL (webhook de Meta y envío por Cloud API) — sin red, sin Meta, sin Workers AI.
 * Secretos y números son ficticios y solo existen dentro de esta prueba.
 */
import { AiError, type LanguageModel } from "@/server/ai/model";
import { singleModel } from "@/server/ai/router";
import { AI_UNAVAILABLE_REPLY, handleIncomingBatch, NON_TEXT_REPLY, type Deps } from "../src/conversation";
import { memoryQueueStorage, OrderedQueue, type QueueMessage } from "../src/queue";
import { createCloudSender, type OutboundSender } from "../src/sender";
import { createMemoryStore } from "../src/store";
import { handleWebhook, type WebhookEnqueue, type WebhookEnv } from "../src/webhook";
import { fakeModel } from "./fakeModel";

const results: Array<{ nombre: string; ok: boolean; detalle: string[] }> = [];
async function prueba(nombre: string, fn: (check: (c: boolean, l: string) => void) => Promise<void>) {
  const detalle: string[] = [];
  let ok = true;
  const check = (c: boolean, l: string) => {
    if (!c) ok = false;
    detalle.push(`${c ? "✓" : "✗"} ${l}`);
  };
  try {
    await fn(check);
  } catch (error) {
    ok = false;
    detalle.push(`✗ excepción: ${error instanceof Error ? error.message : String(error)}`);
  }
  results.push({ nombre, ok, detalle });
}

/* ─────────────────────────── utilidades ─────────────────────────── */

const SECRET = "secreto-de-prueba-123";
const TOKEN_VERIFY = "verificacion-prueba-456";
const ACCESS = "EAAprueba-token-de-acceso-que-nunca-debe-aparecer";
const PHONE_ID = "100000000000001";
const PILOT = "573009990001";
const OTHER = "573009990002";
const env: WebhookEnv = {
  WHATSAPP_MODE: "piloto",
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_VERIFY_TOKEN: TOKEN_VERIFY,
  WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
  WHATSAPP_PILOT_NUMBERS: PILOT,
};
async function sign(body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function payload(opts: {
  from?: string;
  id?: string;
  text?: string;
  type?: string;
  echoTo?: string;
  phoneId?: string;
  status?: string;
}) {
  const value: Record<string, unknown> = {
    messaging_product: "whatsapp",
    metadata: { phone_number_id: opts.phoneId ?? PHONE_ID },
  };
  if (opts.echoTo)
    value.message_echoes = [
      {
        from: "573118023725",
        to: opts.echoTo,
        id: opts.id ?? "wamid.eco1",
        timestamp: "1760000000",
        type: "text",
        text: { body: opts.text ?? "Hola, soy Cristian" },
      },
    ];
  else if (opts.status)
    value.statuses = [
      { id: "wamid.x", status: opts.status, errors: opts.status === "failed" ? [{ code: 131047 }] : [] },
    ];
  else {
    value.contacts = [{ wa_id: opts.from ?? PILOT, profile: { name: "Prueba Piloto" } }];
    value.messages = [
      opts.type && opts.type !== "text"
        ? {
            from: opts.from ?? PILOT,
            id: opts.id ?? "wamid.1",
            timestamp: "1760000000",
            type: opts.type,
            [opts.type]: { id: "media" },
          }
        : {
            from: opts.from ?? PILOT,
            id: opts.id ?? "wamid.1",
            timestamp: "1760000000",
            type: "text",
            text: { body: opts.text ?? "Hola" },
          },
    ];
  }
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: opts.echoTo ? "smb_message_echoes" : "messages", value }] }],
  });
}
const post = (body: string, signature: string | null) =>
  new Request("https://ejemplo.workers.dev/webhook", {
    method: "POST",
    body,
    headers: signature ? { "x-hub-signature-256": signature, "content-type": "application/json" } : {},
  });

/** Captura todo lo que se escribe en la consola durante `fn`. */
async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const lines: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(orig) as Array<keyof typeof orig>)
    console[k] = (...a: unknown[]) =>
      lines.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    Object.assign(console, orig);
  }
}

/* ─────────────────────────── pruebas ─────────────────────────── */

await prueba("W1. GET /webhook: verificación de Meta", async (check) => {
  const ok = await handleWebhook(
    new Request(`https://x/webhook?hub.mode=subscribe&hub.verify_token=${TOKEN_VERIFY}&hub.challenge=12345`),
    env,
    async () => null,
  );
  check(ok.status === 200 && (await ok.text()) === "12345", "token correcto → devuelve el challenge");
  const bad = await handleWebhook(
    new Request("https://x/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345"),
    env,
    async () => null,
  );
  check(bad.status === 403, "token incorrecto → 403");
  const sim = await handleWebhook(
    new Request(`https://x/webhook?hub.mode=subscribe&hub.verify_token=${TOKEN_VERIFY}&hub.challenge=1`),
    { ...env, WHATSAPP_MODE: "simulacion" },
    async () => null,
  );
  check(sim.status === 404, "en modo simulación el webhook no existe (404)");
});

await prueba("W2. Firma: válida se acepta; inválida, ausente o con otro secreto se rechaza", async (check) => {
  const queued: WebhookEnqueue[] = [];
  const enqueue = async (_c: string, m: WebhookEnqueue) => queued.push(m);
  const body = payload({ text: "Hola" });
  const { result, logs } = await captureLogs(async () => ({
    ok: await handleWebhook(post(body, await sign(body)), env, enqueue),
    bad: await handleWebhook(post(body, await sign(body, "otro-secreto")), env, enqueue),
    none: await handleWebhook(post(body, null), env, enqueue),
    tampered: await handleWebhook(post(body.replace("Hola", "Hola!"), await sign(body)), env, enqueue),
  }));
  check(result.ok.status === 200 && queued.length === 1, "firma válida → 200 y entra a la fila");
  check(
    result.bad.status === 401 && result.none.status === 401 && result.tampered.status === 401,
    "firma con otro secreto, sin firma o cuerpo alterado → 401",
  );
  check(queued.length === 1, "lo rechazado NO entra a la fila");
  check(!logs.includes(SECRET) && !logs.includes(PILOT), "los logs no contienen el secreto ni el número completo");
});

await prueba("W3. Mensaje entrante: datos correctos a la fila; piloto, otros números y otros tipos", async (check) => {
  const queued: WebhookEnqueue[] = [];
  const enqueue = async (_c: string, m: WebhookEnqueue) => queued.push(m);
  const send = async (b: string) => handleWebhook(post(b, await sign(b)), env, enqueue);
  await captureLogs(async () => {
    await send(payload({ text: "Quiero cotizar mi carro", id: "wamid.A" }));
    await send(payload({ from: OTHER, text: "Hola Cristian", id: "wamid.B" }));
    await send(payload({ text: "x", id: "wamid.C", phoneId: "999" }));
    await send(payload({ type: "audio", id: "wamid.D" }));
    await send(payload({ status: "failed" }));
  });
  const a = queued.find((m) => m.messageId === "wamid.A");
  check(
    Boolean(a) &&
      a!.from === PILOT &&
      a!.text === "Quiero cotizar mi carro" &&
      a!.name === "Prueba Piloto" &&
      a!.sentAt === 1760000000000,
    "texto, número, nombre y hora correctos",
  );
  check(a!.simulated === false && a!.options.canal === "meta", "marcado como mensaje real de Meta");
  check(
    !queued.some((m) => m.messageId === "wamid.B"),
    "piloto: un cliente real fuera de la lista NO entra (lo atiende Cristian en su app)",
  );
  check(!queued.some((m) => m.messageId === "wamid.C"), "eventos de otro número de la cuenta se ignoran");
  const audio = queued.find((m) => m.messageId === "wamid.D");
  check(
    audio?.options.tipo === "audio" && /audio/.test(audio.text),
    "un audio entra marcado como audio (sin su contenido)",
  );
  check(queued.length === 2, "los estados (entregado/fallido) no generan mensajes");
});

await prueba("W4. Duplicado: Meta reintenta el mismo wamid → se procesa una sola vez", async (check) => {
  let t = 0;
  const processed: string[] = [];
  const q = new OrderedQueue(
    memoryQueueStorage(),
    { now: () => t, setAlarm: () => undefined },
    async (batch: QueueMessage[]) => {
      processed.push(...batch.map((m) => m.id));
      return null;
    },
  );
  const msg = (id: string): QueueMessage => ({
    id,
    from: PILOT,
    name: null,
    text: "Hola",
    sentAt: null,
    simulated: false,
    options: { canal: "meta" },
  });
  const s1 = await q.enqueue(msg("wamid.dup"));
  const s2 = await q.enqueue(msg("wamid.dup"));
  t += 10_000;
  await q.run();
  const s3 = await q.enqueue(msg("wamid.dup"));
  check(
    s1 === "nuevo" && s2 === "duplicado_pendiente" && s3 === "duplicado_procesado",
    "pendiente y ya procesado se reconocen como duplicados",
  );
  check(processed.length === 1, "se procesó una sola vez");
});

/** Sender real con fetch falso. */
function fakeMeta(responses: Array<{ status: number; body: unknown } | "network">) {
  const calls: Array<{ url: string; auth: string; body: Record<string, unknown> }> = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      auth: String((init.headers as Record<string, string>).Authorization),
      body: JSON.parse(String(init.body)),
    });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r === "network") throw new Error("fallo de red");
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return {
    calls,
    sender: createCloudSender({
      accessToken: ACCESS,
      phoneNumberId: PHONE_ID,
      graphVersion: "v23.0",
      fetch: doFetch,
      retryDelays: [0, 0],
      sleep: async () => undefined,
    }),
  };
}

await prueba("W5. Envío de la respuesta por Cloud API", async (check) => {
  const { calls, sender } = fakeMeta([{ status: 200, body: { messages: [{ id: "wamid.out1" }] } }]);
  const r = await sender.send(PILOT, "Hola 👋");
  check(r.status === "enviado" && r.externalId === "wamid.out1", "enviado, con el wamid de Meta");
  check(
    calls[0].url === `https://graph.facebook.com/v23.0/${PHONE_ID}/messages` && calls[0].auth === `Bearer ${ACCESS}`,
    "endpoint oficial y token solo en la cabecera",
  );
  check(
    calls[0].body.to === PILOT &&
      calls[0].body.type === "text" &&
      (calls[0].body.text as { body: string }).body === "Hola 👋",
    "cuerpo con el número y el texto",
  );
});

await prueba(
  "W6. Fallo de Meta: transitorio se reintenta; definitivo queda «fallido»; sin secretos en logs",
  async (check) => {
    const t = fakeMeta([
      { status: 500, body: { error: { code: 1 } } },
      "network",
      { status: 200, body: { messages: [{ id: "wamid.ok" }] } },
    ]);
    const { result: r1, logs: l1 } = await captureLogs(() => t.sender.send(PILOT, "x"));
    check(r1.status === "enviado" && t.calls.length === 3, "500 y fallo de red → reintenta y envía");
    const d = fakeMeta([{ status: 400, body: { error: { code: 131047, message: "Re-engagement message" } } }]);
    const { result: r2, logs: l2 } = await captureLogs(() => d.sender.send(PILOT, "x"));
    check(
      r2.status === "fallido" && r2.errorCode === 131047 && d.calls.length === 1,
      "fuera de la ventana de 24 h (131047): fallido, sin reintentar",
    );
    check(
      ![l1, l2].some((l) => l.includes(ACCESS) || l.includes(PILOT)),
      "los logs no contienen el token ni el número",
    );

    // En el flujo: la respuesta que Meta rechaza queda guardada como fallida y auditada.
    const store = createMemoryStore();
    const deps: Deps = {
      store,
      models: singleModel(fakeModel()),
      sender: d.sender,
      defaultAdvisorId: null,
      siteUrl: "https://dyjvirtualseguros.com",
    };
    await captureLogs(() =>
      handleIncomingBatch(deps, [
        { from: PILOT, text: "Hola, quiero cotizar mi carro", messageId: "wamid.f1", simulated: false },
      ]),
    );
    const out = store.state.messages.filter((m) => m.direction === "saliente");
    check(
      out.length === 1 && out[0].deliveryStatus === "fallido",
      "la respuesta rechazada queda guardada como «fallido»",
    );
    const ev = store.audit.events.find((e) => e.action === "mensaje.enviar");
    check(ev?.outcome === "error" && ev.reason === "meta_131047", "y auditada con el código de Meta");
  },
);

await prueba("W7. Coexistencia: si Cristian responde desde su app, la IA se calla", async (check) => {
  const store = createMemoryStore();
  const sent: string[] = [];
  const sender: OutboundSender = {
    real: true,
    async send(_to, text) {
      sent.push(text);
      return { status: "enviado", externalId: `wamid.o${sent.length}` };
    },
  };
  const deps: Deps = {
    store,
    models: singleModel(fakeModel()),
    sender,
    defaultAdvisorId: null,
    siteUrl: "https://dyjvirtualseguros.com",
  };
  await handleIncomingBatch(deps, [
    { from: PILOT, text: "Hola, quiero cotizar mi carro", messageId: "wamid.c1", simulated: false },
  ]);
  const before = sent.length;
  const eco = await handleIncomingBatch(deps, [
    {
      from: PILOT,
      text: "Hola, soy Cristian. Ya te ayudo",
      messageId: "wamid.eco1",
      simulated: false,
      fromBusiness: true,
    },
  ]);
  const conv = store.state.conversations.find((c) => c.id === eco.conversationId)!;
  check(conv.status === "asesor", "el eco pasa la conversación a «asesor»");
  check(
    store.state.messages.some(
      (m) => m.externalId === "wamid.eco1" && m.author === "asesor" && m.direction === "saliente",
    ),
    "el mensaje de Cristian queda en el historial",
  );
  const next = await handleIncomingBatch(deps, [
    { from: PILOT, text: "Gracias, es una Mazda 2024", messageId: "wamid.c2", simulated: false },
  ]);
  check(next.replies.length === 0 && sent.length === before, "el siguiente mensaje del cliente NO lo responde la IA");
  check(
    store.audit.events.some((e) => e.action === "conversacion.atendida_en_app" && e.actorType === "canal"),
    "auditado (actor: canal)",
  );
});

await prueba("W8. Audio y cupo de IA agotado: nunca se adivina ni se deja sin respuesta", async (check) => {
  const store = createMemoryStore();
  const deps: Deps = {
    store,
    models: singleModel(fakeModel()),
    sender: { real: false, send: async () => ({ status: "simulado" }) },
    defaultAdvisorId: null,
    siteUrl: "https://dyjvirtualseguros.com",
  };
  const a = await handleIncomingBatch(deps, [
    { from: PILOT, text: "[El cliente envió un audio]", messageId: "wamid.au", simulated: false, messageType: "audio" },
  ]);
  check(a.replies[0] === NON_TEXT_REPLY, "audio → pide que lo escriba (no inventa su contenido)");
  const sinCupo: LanguageModel = {
    async generateJson() {
      throw new AiError("3036: daily neuron limit exceeded", "busy");
    },
  };
  const r = await handleIncomingBatch({ ...deps, models: singleModel(sinCupo) }, [
    { from: OTHER, text: "Hola", messageId: "wamid.q", simulated: false },
  ]);
  check(
    r.status === "esperando_asesor" && r.replies[0] === AI_UNAVAILABLE_REPLY,
    "cupo diario agotado → avisa y pasa a una persona",
  );
  const otroFallo: LanguageModel = {
    async generateJson() {
      throw new AiError("Tiempo de espera agotado.", "busy");
    },
  };
  let threw = false;
  try {
    await handleIncomingBatch({ ...deps, models: singleModel(otroFallo) }, [
      { from: "573009990003", text: "Hola", messageId: "wamid.t", simulated: false },
    ]);
  } catch {
    threw = true;
  }
  check(threw, "un fallo pasajero de la IA se relanza (la fila reintenta)");
});

for (const r of results) {
  console.log(`${r.ok ? "PASA " : "FALLA"}  ${r.nombre}`);
  for (const d of r.detalle) if (!r.ok || process.env.DETALLE) console.log(`         ${d}`);
}
const all = results.flatMap((r) => r.detalle);
const bad = all.filter((d) => d.startsWith("✗")).length;
console.log(
  `\nWebhook: ${results.filter((r) => r.ok).length}/${results.length} escenarios · ${all.length - bad}/${all.length} comprobaciones`,
);
if (bad) process.exitCode = 1;
