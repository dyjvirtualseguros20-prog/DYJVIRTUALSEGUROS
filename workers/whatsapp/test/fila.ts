/**
 * PRUEBAS DE LA FILA ORDENADA POR CLIENTE (paso 2.3)
 * ─────────────────────────────────────────────────
 * Lógica real de la fila (src/queue.ts) + flujo real del canal (src/conversation.ts) + núcleo real,
 * con reloj simulado (sin esperas reales), almacenamiento en memoria y modelo de prueba.
 * Sin Cloudflare, sin Supabase y sin Workers AI.
 */
import { AiError, type LanguageModel } from "@/server/ai/model";
import { singleModel } from "@/server/ai/router";
import { handleIncomingBatch } from "../src/conversation";
import {
  DEBOUNCE_MS,
  MAX_ATTEMPTS,
  MAX_WAIT_MS,
  memoryQueueStorage,
  OrderedQueue,
  type QueueMessage,
  type QueueStorage,
} from "../src/queue";
import { simulatedSender } from "../src/sender";
import { createMemoryStore } from "../src/store";
import { fakeModel } from "./fakeModel";

/* ─────────────────────────── arnés ─────────────────────────── */

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
  } catch (e) {
    ok = false;
    detalle.push(`✗ excepción: ${e instanceof Error ? e.message : String(e)}`);
  }
  results.push({ nombre, ok, detalle });
}

/** Reloj y alarma simulados (como los de un Durable Object). */
class Host {
  t = 1_000_000;
  alarm: number | null = null;
  now = () => this.t;
  setAlarm = (at: number) => {
    this.alarm = at;
  };
}

/** Avanza el reloj ejecutando las alarmas que venzan (como haría Cloudflare). */
async function advance(q: OrderedQueue, host: Host, ms: number) {
  const until = host.t + ms;
  while (host.alarm !== null && host.alarm <= until) {
    host.t = Math.max(host.t, host.alarm);
    host.alarm = null;
    await q.run();
  }
  host.t = until;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const msg = (id: string, from: string, text: string, sentAt: number | null = null): QueueMessage => ({
  id: `sim-${id}`,
  from,
  name: null,
  text,
  sentAt,
  simulated: true,
  options: {},
});

/** Entorno de un cliente: almacenamiento compartido, fila propia, modelo de prueba. */
function entorno(opts: { model?: LanguageModel; storage?: QueueStorage; host?: Host; store?: ReturnType<typeof createMemoryStore> } = {}) {
  const store = opts.store ?? createMemoryStore();
  const model = opts.model ?? fakeModel();
  const host = opts.host ?? new Host();
  const storage = opts.storage ?? memoryQueueStorage();
  let processing = 0;
  let maxConcurrent = 0;
  let batches = 0;
  const lotes: string[][] = [];
  const processor = async (batch: QueueMessage[], info: { attempt: number; resume: boolean }) => {
    processing++;
    maxConcurrent = Math.max(maxConcurrent, processing);
    batches++;
    lotes.push(batch.map((m) => m.id));
    try {
      return await handleIncomingBatch(
        { store, models: singleModel(model), sender: simulatedSender, defaultAdvisorId: null, siteUrl: "https://dyjvirtualseguros.com" },
        batch.map((m) => ({ from: m.from, name: m.name, text: m.text, messageId: m.id, simulated: true })),
        { resume: info.resume },
      );
    } finally {
      processing--;
    }
  };
  const queue = new OrderedQueue(storage, host, processor, async (id) => store.messageExists(id));
  return {
    store,
    model,
    host,
    storage,
    queue,
    processor,
    stats: () => ({ batches, maxConcurrent, lotes }),
  };
}

const inbound = (store: ReturnType<typeof createMemoryStore>) => store.state.messages.filter((m) => m.direction === "entrante");
const outbound = (store: ReturnType<typeof createMemoryStore>) => store.state.messages.filter((m) => m.direction === "saliente");
const sinDuplicados = (store: ReturnType<typeof createMemoryStore>) => {
  const ids = store.state.messages.map((m) => m.externalId).filter(Boolean);
  return new Set(ids).size === ids.length;
};

/* ─────────────────────────── pruebas ─────────────────────────── */

await prueba("A. Dos mensajes simultáneos del mismo cliente → un solo turno, en orden", async (check) => {
  const e = entorno();
  const [s1, s2] = await Promise.all([
    e.queue.enqueue(msg("a1", "573000000201", "Hola")),
    e.queue.enqueue(msg("a2", "573000000201", "quiero cotizar mi carro")),
  ]);
  check(s1 === "nuevo" && s2 === "nuevo", "ambos entran a la fila");
  await advance(e.queue, e.host, DEBOUNCE_MS);
  const st = e.stats();
  check(st.batches === 1 && st.maxConcurrent === 1, "un solo lote, nunca dos a la vez");
  check(st.lotes[0].join(",") === "sim-a1,sim-a2", "orden de llegada respetado");
  check(inbound(e.store).length === 2 && outbound(e.store).length === 1, "2 mensajes guardados, 1 respuesta");
});

await prueba("B. Ráfaga de 4 mensajes → espera la pausa y los procesa juntos", async (check) => {
  const e = entorno();
  const from = "573000000202";
  const textos = ["Hola", "quiero cotizar", "una Mazda CX-5", "modelo 2024"];
  for (const [i, t] of textos.entries()) {
    await e.queue.enqueue(msg(`b${i + 1}`, from, t));
    await advance(e.queue, e.host, 500); // escribe cada 0,5 s
  }
  check(e.stats().batches === 0, "no responde a mitad de la ráfaga");
  await advance(e.queue, e.host, DEBOUNCE_MS - 500 - 1);
  check(e.stats().batches === 0, `espera ${DEBOUNCE_MS} ms desde el último mensaje`);
  await advance(e.queue, e.host, 1);
  check(e.stats().batches === 1 && e.stats().lotes[0].length === 4, "procesa los 4 en un solo lote");
  check((e.model as ReturnType<typeof fakeModel>).lastUserMessage === textos.join("\n"), "la IA lee la ráfaga completa, en orden");
  check((e.model as ReturnType<typeof fakeModel>).calls === 1, "una sola llamada a la IA");
});

await prueba("B2. Cliente que no para de escribir → espera máxima", async (check) => {
  const e = entorno();
  for (let i = 0; i < 6; i++) {
    await e.queue.enqueue(msg(`bm${i}`, "573000000212", `mensaje ${i}`));
    await advance(e.queue, e.host, 2000); // nunca deja una pausa de 2,5 s
  }
  check(e.stats().batches >= 1, `procesa como máximo ${MAX_WAIT_MS} ms después del primer mensaje`);
});

await prueba("C. Mensajes que llegan fuera de orden → se ordenan por su hora", async (check) => {
  const e = entorno();
  const from = "573000000203";
  await e.queue.enqueue(msg("c3", from, "tres", 3000));
  await e.queue.enqueue(msg("c1", from, "uno", 1000));
  await e.queue.enqueue(msg("c2", from, "dos", 2000));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(e.stats().lotes[0].join(",") === "sim-c1,sim-c2,sim-c3", "orden por la hora del mensaje");
  check(inbound(e.store).map((m) => m.body).join(",") === "uno,dos,tres", "se guardan en el orden correcto");
  check((e.model as ReturnType<typeof fakeModel>).lastUserMessage === "uno\ndos\ntres", "la IA los lee en orden");
});

await prueba("D. Mensaje duplicado → no se procesa ni se responde dos veces", async (check) => {
  const e = entorno();
  const from = "573000000204";
  const r1 = await e.queue.enqueue(msg("d1", from, "Quiero cotizar mi carro"));
  const r2 = await e.queue.enqueue(msg("d1", from, "Quiero cotizar mi carro"));
  check(r1 === "nuevo" && r2 === "duplicado_pendiente", "duplicado mientras está pendiente");
  await advance(e.queue, e.host, DEBOUNCE_MS);
  const r3 = await e.queue.enqueue(msg("d1", from, "Quiero cotizar mi carro"));
  await advance(e.queue, e.host, DEBOUNCE_MS * 2);
  check(r3 === "duplicado_procesado", "duplicado después de procesado (reintento de Meta)");
  // Fila nueva (sin memoria) pero el mensaje ya está en la base de datos → también duplicado.
  const otra = new OrderedQueue(memoryQueueStorage(), new Host(), e.processor, async (id) => e.store.messageExists(id));
  check((await otra.enqueue(msg("d1", from, "Quiero cotizar mi carro"))) === "duplicado_procesado", "la base de datos también lo detecta");
  check(inbound(e.store).length === 1 && outbound(e.store).length === 1 && e.stats().batches === 1, "1 mensaje, 1 respuesta, 1 lote");
});

await prueba("E. Reinicio del Durable Object → los pendientes se retoman una sola vez", async (check) => {
  const store = createMemoryStore();
  const storage = memoryQueueStorage();
  const host = new Host();
  const e1 = entorno({ store, storage, host });
  await e1.queue.enqueue(msg("e1", "573000000205", "Hola"));
  await e1.queue.enqueue(msg("e2", "573000000205", "quiero cotizar"));
  // "Reinicio": la instancia desaparece; el almacenamiento (SQLite) y la alarma siguen.
  const e2 = entorno({ store, storage, host });
  await advance(e2.queue, host, DEBOUNCE_MS);
  check(e2.stats().batches === 1 && e1.stats().batches === 0, "la instancia nueva procesa los pendientes");
  check(inbound(store).length === 2 && outbound(store).length === 1, "sin pérdidas ni duplicados");

  // Reinicio A MITAD de un lote (los mensajes ya se guardaron pero no hubo respuesta).
  const store3 = createMemoryStore();
  const storage3 = memoryQueueStorage();
  const host3 = new Host();
  const bloqueo = deferred();
  const colgado: LanguageModel = { generateJson: () => bloqueo.promise.then(() => ({})) };
  const e3 = entorno({ store: store3, storage: storage3, host: host3, model: colgado });
  await e3.queue.enqueue(msg("e3", "573000000215", "Quiero cotizar mi carro"));
  host3.t += DEBOUNCE_MS;
  host3.alarm = null;
  void e3.queue.run(); // queda colgado dentro de la IA: simula que el objeto "muere" aquí
  await new Promise((r) => setTimeout(r, 0));
  check(inbound(store3).length === 1 && outbound(store3).length === 0, "el mensaje quedó guardado sin respuesta");
  host3.alarm = host3.t; // la alarma persistida vuelve a disparar tras el reinicio
  const e4 = entorno({ store: store3, storage: storage3, host: host3 });
  await advance(e4.queue, host3, 1);
  check(outbound(store3).length === 1, "tras el reinicio el lote se completa (no se descarta como duplicado)");
  check(inbound(store3).length === 1 && sinDuplicados(store3), "sin mensajes duplicados");
});

await prueba("F. Llega un mensaje mientras otro se procesa → espera su turno", async (check) => {
  const bloqueo = deferred();
  const base = fakeModel();
  let concurrentes = 0;
  let maxConc = 0;
  const lento: LanguageModel = {
    async generateJson(...args) {
      concurrentes++;
      maxConc = Math.max(maxConc, concurrentes);
      await bloqueo.promise;
      concurrentes--;
      return base.generateJson(...args);
    },
  };
  const e = entorno({ model: lento });
  const from = "573000000206";
  await e.queue.enqueue(msg("f1", from, "Quiero cotizar mi carro"));
  e.host.t += DEBOUNCE_MS;
  e.host.alarm = null;
  const corriendo = e.queue.run();
  await new Promise((r) => setTimeout(r, 0));
  check(e.queue.busy, "el primer lote está en proceso");
  await e.queue.enqueue(msg("f2", from, "es una Mazda CX-5"));
  const segunda = e.queue.run(); // la alarma de f2 llega mientras tanto
  await new Promise((r) => setTimeout(r, 0));
  check(e.stats().batches === 1, "no arranca un segundo lote mientras el primero está en curso");
  bloqueo.resolve();
  await segunda;
  await corriendo;
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(maxConc === 1, "nunca dos turnos de IA a la vez");
  check(e.stats().lotes.map((l) => l.join("+")).join(" | ") === "sim-f1 | sim-f2", "f2 se procesa después, en su propio turno");
  check(outbound(e.store).length === 2 && sinDuplicados(e.store), "una respuesta por turno, sin duplicados");
});

await prueba("G. Fallo controlado y recuperación (base de datos y modelo)", async (check) => {
  // Base de datos caída al guardar el estado: no se responde nada; se reintenta y se completa.
  const e = entorno();
  const from = "573000000207";
  e.store.failOnce("updateConversation");
  await e.queue.enqueue(msg("g1", from, "Quiero cotizar mi carro"));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(outbound(e.store).length === 0, "durante el fallo NO se envía ninguna respuesta");
  check(e.storage.get("sim-g1")?.state === "pendiente", "el mensaje NO queda marcado como procesado");
  // Llega otro mensaje durante la espera del reintento: no se adelanta al anterior.
  await e.queue.enqueue(msg("g2", from, "es una Mazda CX-5"));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(outbound(e.store).length === 0, "el mensaje nuevo espera al reintento (no se adelanta)");
  await advance(e.queue, e.host, 15_000);
  check(e.storage.get("sim-g1")?.state === "procesado" && e.storage.get("sim-g2")?.state === "procesado", "ambos procesados tras el reintento");
  check(inbound(e.store).map((m) => m.externalId).join(",") === "sim-g1,sim-g2", "orden conservado, sin duplicar el mensaje ya guardado");
  check(outbound(e.store).length === 1 && sinDuplicados(e.store), "una sola respuesta");

  // Modelo con fallo puntual → reintento correcto.
  let fallas = 1;
  const base = fakeModel();
  const inestable: LanguageModel = {
    async generateJson(...a) {
      if (fallas-- > 0) throw new AiError("fallo puntual", "failed");
      return base.generateJson(...a);
    },
  };
  const e2 = entorno({ model: inestable });
  await e2.queue.enqueue(msg("g3", "573000000217", "Quiero cotizar mi carro"));
  await advance(e2.queue, e2.host, DEBOUNCE_MS + 5_000);
  check(outbound(e2.store).length === 1 && e2.stats().batches === 2, "falla una vez, se reintenta y responde una vez");

  // Fallo permanente → queda "fallido" para revisión humana, sin respuesta inventada.
  const roto: LanguageModel = {
    async generateJson() {
      throw new AiError("caído", "failed");
    },
  };
  const e3 = entorno({ model: roto });
  await e3.queue.enqueue(msg("g4", "573000000227", "Hola"));
  const espera = e3.queue.waitFor("sim-g4", 10_000_000);
  await advance(e3.queue, e3.host, 600_000);
  check(e3.storage.get("sim-g4")?.state === "fallido" && e3.storage.get("sim-g4")?.attempts === MAX_ATTEMPTS, `tras ${MAX_ATTEMPTS} intentos: fallido`);
  check(outbound(e3.store).length === 0, "nunca se envía una respuesta inventada");
  check(JSON.stringify(await espera).includes("fallido"), "quien espera recibe el estado de fallo");
});

await prueba("H. Dos clientes distintos → no se bloquean entre sí", async (check) => {
  const store = createMemoryStore();
  const bloqueo = deferred();
  const base = fakeModel();
  const lentoA: LanguageModel = {
    async generateJson(...a) {
      await bloqueo.promise;
      return base.generateJson(...a);
    },
  };
  const a = entorno({ store, model: lentoA });
  const b = entorno({ store });
  await a.queue.enqueue(msg("h1", "573000000208", "Quiero cotizar mi carro"));
  await b.queue.enqueue(msg("h2", "573000000218", "Quiero cotizar mi carro"));
  a.host.t += DEBOUNCE_MS;
  a.host.alarm = null;
  const procesoA = a.queue.run();
  await advance(b.queue, b.host, DEBOUNCE_MS);
  const respB = outbound(store).filter((m) => m.externalId?.startsWith("sim-h2"));
  check(a.queue.busy && respB.length === 1, "el cliente B recibe respuesta mientras A sigue en proceso");
  bloqueo.resolve();
  await procesoA;
  check(outbound(store).filter((m) => m.externalId?.startsWith("sim-h1")).length === 1, "A termina después, sin interferencias");
});

await prueba("I. La ráfaga conserva cada mensaje individual", async (check) => {
  const e = entorno();
  const from = "573000000209";
  for (const [i, t] of ["Hola", "quiero cotizar", "un carro", "tengo diabetes y vivo en Cali"].entries())
    await e.queue.enqueue(msg(`i${i + 1}`, from, t));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  const rows = inbound(e.store);
  check(rows.length === 4, "4 mensajes guardados por separado");
  check(rows.map((r) => r.externalId).join(",") === "sim-i1,sim-i2,sim-i3,sim-i4", "cada uno con su propio ID, en orden");
  check(!rows.some((r) => /diabetes/i.test(r.body)) && rows[3].healthRedacted === true, "la salud se oculta mensaje por mensaje");
});

await prueba("J. Sin respuestas duplicadas (reintentos, duplicados y ACEPTO doble)", async (check) => {
  const e = entorno();
  const from = "573000000210";
  await e.queue.enqueue(
    msg("j1", from, "Soy Carlos Pérez, cédula 1020304050, vivo en Bogotá, tengo una Mazda CX-5 2023 placa ABC123, uso particular, todo riesgo"),
  );
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(e.store.state.conversations[0].pendingAction === "confirmar_solicitud", "queda esperando ACEPTO");
  // Dos ACEPTO casi seguidos (misma ráfaga) y uno más después.
  await e.queue.enqueue(msg("j2", from, "acepto"));
  await e.queue.enqueue(msg("j3", from, "Sí, acepto"));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  await e.queue.enqueue(msg("j4", from, "acepto"));
  await advance(e.queue, e.host, DEBOUNCE_MS);
  check(e.store.state.quoteRequests.length === 1, "una sola solicitud registrada");
  check(e.store.state.consents.length === 2, "una sola vez las autorizaciones A y B");
  check(sinDuplicados(e.store), "ningún mensaje ni respuesta duplicado");
});

await prueba("V. Versión: un asesor toma la conversación durante el turno → la IA no escribe encima", async (check) => {
  const store = createMemoryStore();
  const base = fakeModel();
  let tomada = false;
  const conAsesor: LanguageModel = {
    async generateJson(...a) {
      // Mientras la IA "piensa", un asesor toma la conversación desde /admin (sube la versión).
      if (!tomada) {
        tomada = true;
        const c = store.state.conversations[0];
        c.status = "asesor";
        c.version++;
      }
      return base.generateJson(...a);
    },
  };
  const e = entorno({ store, model: conAsesor });
  await e.queue.enqueue(msg("v1", "573000000211", "Quiero cotizar mi carro"));
  await advance(e.queue, e.host, 30_000);
  const c = store.state.conversations[0];
  check(c.status === "asesor", "el estado del asesor NO se sobrescribe con «bot»");
  check(outbound(store).length === 0, "la IA no responde en una conversación tomada por un asesor");
  check(e.storage.get("sim-v1")?.state === "procesado", "el mensaje queda procesado (guardado para el asesor)");

  // La versión solo sube cuando cambia el estado (igual que el trigger 0007).
  const v0 = c.version;
  await store.updateConversation(c.id, { status: "asesor" });
  check(c.version === v0, "escribir el mismo estado no sube la versión");
  await store.updateConversation(c.id, { status: "bot" }, v0);
  check(c.version === v0 + 1, "un cambio de estado sube la versión en 1");
  let rechazada = false;
  try {
    await store.updateConversation(c.id, { status: "cerrada" }, v0);
  } catch {
    rechazada = true;
  }
  check(rechazada && c.status === "bot", "una escritura con versión vieja se rechaza");
});

/* ─────────────────────────── informe ─────────────────────────── */

for (const r of results) {
  console.log(`${r.ok ? "PASA " : "FALLA"}  ${r.nombre}`);
  for (const d of r.detalle) if (!r.ok || process.env.DETALLE) console.log(`         ${d}`);
}
const checks = results.flatMap((r) => r.detalle);
const fallos = checks.filter((d) => d.startsWith("✗")).length;
console.log(`\nFila: ${results.filter((r) => r.ok).length}/${results.length} escenarios · ${checks.length - fallos}/${checks.length} comprobaciones`);
if (fallos) process.exitCode = 1;
