/**
 * PRUEBAS DE AUDITORÍA Y TOOLRUNNER EN WHATSAPP (paso 2.5)
 * ────────────────────────────────────────────────────────
 * Flujo real del canal (src/conversation.ts) + herramientas reales (src/tools.ts) + ToolRunner,
 * con almacenamiento y auditoría en memoria y modelo de prueba. Sin Supabase ni Workers AI.
 */
import { singleModel } from "@/server/ai/router";
import type { AuditEvent } from "@/server/tools/audit";
import { createToolRunner, type Actor } from "@/server/tools/runner";
import { handleIncoming, type Deps, type Outcome } from "../src/conversation";
import { simulatedSender } from "../src/sender";
import { createMemoryStore } from "../src/store";
import { actualizarTurno, asignarAsesor, IA_WHATSAPP, registrarSolicitud } from "../src/tools";
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
  } catch (error) {
    ok = false;
    detalle.push(`✗ excepción: ${error instanceof Error ? error.message : String(error)}`);
  }
  results.push({ nombre, ok, detalle });
}

type Store = ReturnType<typeof createMemoryStore>;
const deps = (store: Store): Deps => ({
  store,
  models: singleModel(fakeModel()),
  sender: simulatedSender,
  defaultAdvisorId: null,
  siteUrl: "https://dyjvirtualseguros.com",
});
let seq = 0;
const send = (store: Store, from: string, text: string, messageId?: string): Promise<Outcome> =>
  handleIncoming(deps(store), { from, text, messageId: messageId ?? `sim-herr-${++seq}`, simulated: true });

const COMPLETA =
  "Soy Carlos Pérez, cédula 1020304050, vivo en Bogotá, tengo una Mazda CX-5 2023 placa ABC123, uso particular, todo riesgo";
const eventos = (store: Store, action?: string) => store.audit.events.filter((e) => !action || e.action === action);

/** Ningún evento contiene datos personales ni el texto de los mensajes. */
function sinDatosSensibles(events: AuditEvent[]) {
  const texto = JSON.stringify(events);
  return !/Carlos|Pérez|1020304050|ABC123|3000000\d{3}|5730000|Bogot|acepto/i.test(texto);
}

/* ─────────────────────────── pruebas ─────────────────────────── */

await prueba(
  "T1. Acción permitida: turno y registro con ACEPTO quedan auditados (sin datos personales)",
  async (check) => {
    const store = createMemoryStore();
    const from = "573000000101";
    await send(store, from, COMPLETA);
    const ok = await send(store, from, "Sí, acepto");
    check(Boolean(ok.quoteReference), `solicitud registrada (${ok.quoteReference})`);
    const turno = eventos(store, "conversacion.actualizar_turno");
    check(
      turno.length === 1 && turno[0].outcome === "exito" && turno[0].level === "ejecutar",
      "turno: 1 evento EJECUTAR con éxito",
    );
    const reg = eventos(store, "solicitud.registrar");
    check(reg.length === 1 && reg[0].outcome === "exito", "registro: 1 evento con éxito");
    check(
      reg[0]?.actorType === "ia" && reg[0]?.actorId === "asesor-virtual" && reg[0]?.channel === "whatsapp",
      "actor: la IA del canal WhatsApp",
    );
    check(
      reg[0]?.resourceType === "chat_conversation" && reg[0]?.resourceId === ok.conversationId,
      "recurso: la conversación",
    );
    check(
      reg[0]?.metadata.reference === ok.quoteReference && reg[0]?.metadata.insuranceType === "vehiculos",
      "metadatos: referencia y tipo de seguro",
    );
    check(
      reg[0]?.idempotencyKey?.startsWith(`solicitud.registrar:${ok.conversationId}:`) === true,
      "con clave de idempotencia",
    );
    check(
      sinDatosSensibles(store.audit.events),
      "ningún evento contiene nombre, cédula, placa, teléfono, ciudad ni el texto",
    );
  },
);

await prueba("T2. Escalar: un accidente queda auditado como ESCALAR", async (check) => {
  const store = createMemoryStore();
  const out = await send(store, "573000000102", "Me acaban de chocar, ¿qué hago?");
  check(out.status === "esperando_asesor", "la conversación pasa a una persona");
  const esc = eventos(store, "conversacion.escalar");
  check(esc.length === 1 && esc[0].level === "escalar" && esc[0].outcome === "exito", "evento ESCALAR con éxito");
  check(esc[0]?.metadata.escalationReason === "accidente", "con el motivo (accidente)");
  check(eventos(store, "conversacion.actualizar_turno").length === 0, "no se usa la acción de turno normal");
});

await prueba(
  "T3. Acción denegada por política: registrar desactivado → no registra, pasa a un asesor",
  async (check) => {
    const store = createMemoryStore(undefined, { "solicitud.registrar": { enabled: false, requiresHuman: false } });
    const from = "573000000103";
    await send(store, from, COMPLETA);
    const out = await send(store, from, "ACEPTO");
    check(out.quoteReference === null && store.state.quoteRequests.length === 0, "no se registra ninguna solicitud");
    check(store.state.consents.length === 0, "no se registran autorizaciones");
    const reg = eventos(store, "solicitud.registrar");
    check(
      reg.length === 1 && reg[0].outcome === "denegado" && reg[0].reason === "accion_desactivada",
      "auditado: denegado (accion_desactivada)",
    );
    check(
      out.status === "esperando_asesor" && eventos(store, "conversacion.escalar").at(-1)?.outcome === "exito",
      "se escala a una persona (auditado)",
    );
    check(/asesor de D&J revisará/.test(out.replies.join(" ")), "el cliente sabe que lo atiende un asesor");
  },
);

await prueba("T4. Requiere humano: la IA solo PROPONE (no ejecuta)", async (check) => {
  const store = createMemoryStore(undefined, { "solicitud.registrar": { enabled: true, requiresHuman: true } });
  const from = "573000000104";
  await send(store, from, COMPLETA);
  const out = await send(store, from, "acepto");
  check(store.state.quoteRequests.length === 0, "no se ejecuta el registro");
  check(
    store.proposals.proposals.length === 1 && store.proposals.proposals[0].action === "solicitud.registrar",
    "queda 1 propuesta pendiente",
  );
  check(eventos(store, "solicitud.registrar")[0]?.outcome === "propuesto", "auditado: propuesto");
  check(out.status === "esperando_asesor", "pasa a una persona");

  const runner = createToolRunner(store.tools);
  const r = await runner.run(
    asignarAsesor,
    IA_WHATSAPP,
    { store },
    { conversationId: out.conversationId, advisorId: "cristian" },
    { idempotencyKey: "p-1" },
  );
  await runner.run(
    asignarAsesor,
    IA_WHATSAPP,
    { store },
    { conversationId: out.conversationId, advisorId: "cristian" },
    { idempotencyKey: "p-1" },
  );
  check(r.status === "propuesto", "asignar asesor (acción delicada): la IA solo propone");
  check(
    store.proposals.proposals.filter((p) => p.action === "conversacion.asignar_asesor").length === 1,
    "la misma propuesta no se duplica",
  );
  check(
    store.state.conversations.find((c) => c.id === out.conversationId)?.assignedAdvisorId === null,
    "el asesor no cambió",
  );
});

await prueba("T5. Actor no permitido, entrada inválida y sin ACEPTO → denegado y auditado", async (check) => {
  const store = createMemoryStore();
  const from = "573000000105";
  const first = await send(store, from, COMPLETA);
  const conv = store.state.conversations.find((c) => c.id === first.conversationId)!;
  const runner = createToolRunner(store.tools);
  const admin: Actor = { type: "admin", id: "00000000-0000-4000-8000-000000000001", channel: "admin", active: true };
  const a = await runner.run(
    actualizarTurno,
    admin,
    { store },
    { conversationId: conv.id, expectedVersion: conv.version, patch: {} },
  );
  check(
    a.status === "denegado" && a.reason === "actor_no_permitido",
    "un actor que no es la IA no usa la herramienta de la IA",
  );
  const b = await runner.run(
    actualizarTurno,
    IA_WHATSAPP,
    { store },
    { conversationId: conv.id, expectedVersion: conv.version, patch: { status: "asesor" } },
  );
  check(
    b.status === "denegado" && b.reason === "entrada_invalida",
    "la IA no puede marcar la conversación como tomada por un asesor",
  );
  const c = await runner.run(
    registrarSolicitud,
    IA_WHATSAPP,
    { store },
    { conversation: structuredClone(conv), contactId: conv.contactId, evidenceMessageId: null, accepted: false },
    { idempotencyKey: "sin-acepto" },
  );
  check(c.status === "denegado" && c.reason === "sin_autorizacion_del_cliente", "sin ACEPTO no se registra");
  check(store.state.quoteRequests.length === 0, "ninguna solicitud");
  check(
    eventos(store).filter((e) => e.outcome === "denegado").length === 3,
    "los 3 intentos quedan auditados como denegados",
  );
});

await prueba("T6. Idempotencia: la misma confirmación dos veces → una sola solicitud", async (check) => {
  const store = createMemoryStore();
  const from = "573000000106";
  const first = await send(store, from, COMPLETA);
  const conv = structuredClone(store.state.conversations.find((c) => c.id === first.conversationId)!);
  const runner = createToolRunner(store.tools);
  const input = { conversation: conv, contactId: conv.contactId, evidenceMessageId: "m1", accepted: true };
  const key = `solicitud.registrar:${conv.id}:wamid-1`;
  const r1 = await runner.run(registrarSolicitud, IA_WHATSAPP, { store }, input, { idempotencyKey: key });
  const r2 = await runner.run(registrarSolicitud, IA_WHATSAPP, { store }, input, { idempotencyKey: key });
  check(r1.status === "ok", "primera: ejecutada");
  check(
    r2.status === "duplicado" &&
      (r2.data as { reference: string }).reference === (r1.status === "ok" ? r1.data.reference : ""),
    "segunda: duplicado con la misma referencia",
  );
  check(
    store.state.quoteRequests.length === 1 && store.state.consents.length === 2,
    "una sola solicitud y un solo par de autorizaciones",
  );
  check(
    eventos(store, "solicitud.registrar")
      .map((e) => e.outcome)
      .join(",") === "exito,duplicado",
    "auditado: éxito y luego duplicado",
  );
});

await prueba("T7. Fallo durante la acción: error auditado, se relanza y el reintento funciona", async (check) => {
  const store = createMemoryStore();
  const from = "573000000107";
  store.failOnce("updateConversation");
  let lanzo = false;
  try {
    await send(store, from, "Hola, quiero cotizar un seguro de vida", "wamid-fallo-1");
  } catch {
    lanzo = true;
  }
  check(lanzo, "el error llega a la fila (que reintenta)");
  const err = eventos(store, "conversacion.actualizar_turno").at(-1);
  check(
    err?.outcome === "error" && /no disponible/.test(err.errorMessage ?? ""),
    "auditado: error con su mensaje técnico",
  );
  check(store.state.messages.filter((m) => m.direction === "saliente").length === 0, "no se respondió nada");

  const retry = await handleIncoming(deps(store), {
    from,
    text: "Hola, quiero cotizar un seguro de vida",
    messageId: "wamid-fallo-1",
    simulated: true,
  }).catch(() => null);
  // Reintento de la fila (resume): el mensaje ya guardado se reutiliza.
  const { handleIncomingBatch } = await import("../src/conversation");
  const resumed = await handleIncomingBatch(
    deps(store),
    [{ from, text: "Hola, quiero cotizar un seguro de vida", messageId: "wamid-fallo-1", simulated: true }],
    { resume: true },
  );
  check(retry?.duplicate === true, "sin la marca de reintento, el mismo mensaje es un duplicado");
  check(resumed.replies.length >= 1, "el reintento responde");
  check(
    eventos(store, "conversacion.actualizar_turno").at(-1)?.outcome === "exito",
    "auditado: el reintento con éxito",
  );
});

await prueba("T8. Fallo de la auditoría: la acción no se pierde y queda marcada", async (check) => {
  const store = createMemoryStore();
  const first = await send(store, "573000000108", "Hola");
  const conv = store.state.conversations.find((c) => c.id === first.conversationId)!;
  const runner = createToolRunner(store.tools);
  store.audit.failNext();
  const r = await runner.run(
    actualizarTurno,
    IA_WHATSAPP,
    { store },
    { conversationId: conv.id, expectedVersion: conv.version, patch: { intent: "informacion" } },
  );
  check(
    r.status === "ok" && r.auditFailed === true,
    "la acción se ejecutó y el fallo de auditoría queda señalado (y en el log)",
  );
});

await prueba("T9. Compatibilidad: conversación con un asesor → la IA no actúa ni deja acciones", async (check) => {
  const store = createMemoryStore();
  const from = "573000000109";
  const first = await send(store, from, "Hola");
  const conv = store.state.conversations.find((c) => c.id === first.conversationId)!;
  conv.status = "asesor";
  const antes = store.audit.events.length;
  const out = await send(store, from, "¿Siguen ahí?");
  check(out.replies.length === 0 && store.audit.events.length === antes, "sin respuesta y sin acciones de la IA");
});

await prueba(
  "T10. MVP de punta a punta: cotiza, recuerda, registra, informa el estado real y escala",
  async (check) => {
    const store = createMemoryStore(["cristian", "prueba-mvp"]);
    const from = "573000000777";
    const go = (text: string, messageId?: string, asesor?: string) =>
      handleIncoming(deps(store), {
        from,
        text,
        messageId: messageId ?? `sim-mvp-${++seq}`,
        simulated: true,
        referralAdvisorId: asesor,
      });

    const r1 = await go("Hola, quiero cotizar un seguro todo riesgo para mi carro.", undefined, "prueba-mvp");
    check(
      r1.intent === "cotizacion" && r1.missing.length > 0,
      `entiende que quiere cotizar (faltan: ${r1.missing.join(", ")})`,
    );
    const r2 = await go("Es una Mazda CX-5 2024");
    check(
      ["brand", "year"].every((f) => r2.known.includes(f)) &&
        !r2.missing.includes("brand") &&
        !r2.missing.includes("year"),
      "recuerda marca y año; no los vuelve a pedir",
    );
    const r3 = await go("Me llamo Andrea Prueba Ruiz");
    check(r3.known.includes("brand") && r3.known.includes("fullName"), "conserva lo anterior y suma el nombre");
    await go("mi cédula es 52123456 y vivo en Medellín");
    const r5 = await go("placa XYZ987, uso particular");
    check(
      r5.missing.length === 0 && /responde ACEPTO/.test(r5.replies.at(-1) ?? ""),
      `completa: pide confirmación (faltan: ${r5.missing.join(", ") || "—"})`,
    );

    const before = await go("¿Qué pasó con mi cotización?");
    check(/falta tu confirmación/.test(before.replies[0] ?? ""), "antes de ACEPTO: dice que aún no está registrada");

    const ok = await go("ACEPTO", "sim-mvp-acepto");
    const dup = await go("ACEPTO", "sim-mvp-acepto");
    const again = await go("acepto");
    check(
      Boolean(ok.quoteReference) && dup.duplicate && !again.quoteReference,
      "ACEPTO registra; repetido o reenviado no registra otra",
    );
    check(
      again.replies.length === 1 && again.replies[0].includes(ok.quoteReference!),
      "un ACEPTO repetido informa la solicitud ya registrada",
    );
    const reg = store.state.conversations.find((c) => c.id === ok.conversationId)!;
    check(
      !reg.leadState.fields.plate && reg.leadState.fields.fullName === "Andrea Prueba Ruiz",
      "tras registrar: se limpian los datos del vehículo y se conservan los de la persona",
    );
    check(
      store.state.quoteRequests.length === 1 && store.state.quoteRequests[0].advisorId === "prueba-mvp",
      "UNA solicitud, asignada al asesor del enlace",
    );
    check(
      store.state.links.length === 1 && store.state.links[0].contactId === store.state.contacts[0].id,
      "vinculada al contacto",
    );

    const st = await go("¿Qué pasó con mi cotización?");
    check(
      new RegExp(ok.quoteReference!).test(st.replies[0] ?? "") && /Nueva solicitud/.test(st.replies[0] ?? ""),
      "estado real: referencia y «Nueva solicitud»",
    );
    check(
      /Todavía no tengo el resultado de las aseguradoras/.test(st.replies[0] ?? "") &&
        !/\$|\d{3}\.\d{3}/.test(st.replies[0] ?? ""),
      "no inventa resultado ni precio",
    );
    store.state.quoteRequests[0].status = "cotizando";
    const st2 = await go("como va mi solicitud");
    check(/«Cotizando»/.test(st2.replies[0] ?? ""), "si el asesor cambia el estado, lo informa (los datos mandan)");

    const alt = await go("Está muy caro, quiero otra opción");
    check(
      alt.status === "esperando_asesor" && /no manejo precios/.test(alt.replies[0] ?? ""),
      "«muy caro»: no negocia ni inventa, pasa a su asesor",
    );
    check(
      store.proposals.proposals.some((p) => p.action === "solicitud.pedir_revision"),
      "queda una propuesta pendiente para el asesor",
    );
    check(
      eventos(store, "contexto.consultar_solicitudes").length === 5,
      "las consultas de contexto quedan auditadas (LEER)",
    );

    // Otro número no ve las solicitudes de este contacto.
    const otro = await handleIncoming(deps(store), {
      from: "573000000778",
      text: "¿Qué pasó con mi cotización?",
      messageId: "sim-mvp-otro",
      simulated: true,
    });
    check(/Todavía no tengo una solicitud/.test(otro.replies[0] ?? ""), "otro número no ve solicitudes ajenas");

    // Un enlace de un asesor que no es de la base central (Jeisson) no asigna nada.
    const j = await handleIncoming(deps(store), {
      from: "573000000779",
      text: "Hola, quiero cotizar mi carro",
      messageId: "sim-mvp-j",
      simulated: true,
      referralAdvisorId: "jeisson",
    });
    check(
      store.state.conversations.find((c) => c.id === j.conversationId)?.assignedAdvisorId === null,
      "Jeisson no recibe clientes de la base central",
    );
  },
);

/* ─────────────────────────── informe ─────────────────────────── */

for (const r of results) {
  console.log(`${r.ok ? "PASA " : "FALLA"}  ${r.nombre}`);
  for (const d of r.detalle) if (!r.ok || process.env.DETALLE) console.log(`         ${d}`);
}
const all = results.flatMap((r) => r.detalle);
const bad = all.filter((d) => d.startsWith("✗")).length;
console.log(
  `\nHerramientas: ${results.filter((r) => r.ok).length}/${results.length} escenarios · ${all.length - bad}/${all.length} comprobaciones`,
);
if (bad) process.exitCode = 1;
