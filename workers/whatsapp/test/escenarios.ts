/**
 * PRUEBAS DEL SÚPER ASESOR D&J (canal WhatsApp, núcleo común)
 * ──────────────────────────────────────────────────────────
 * Sin base de datos y sin consumir el cupo de Workers AI:
 *   - MemoryStore en lugar de Supabase.
 *   - "Modelo de prueba" que devuelve JSON como lo haría la IA (intención, confianza, marca/línea).
 * Lo que se prueba es la lógica real del sistema: núcleo (server/assistant/core.ts),
 * extracción y validación de datos, memoria de la conversación, escalamiento, duplicados,
 * ocultamiento de datos de salud, bloqueo de precios inventados y autorizaciones.
 */
import { EMPTY_LEAD } from "@/lib/chat";
import type { LanguageModel, ModelMessage } from "@/server/ai/model";
import { singleModel } from "@/server/ai/router";
import { runAssistantTurn } from "@/server/assistant/core";
import { HEALTH_PLACEHOLDER } from "@/server/assistant/grounding";
import { handleIncoming, type Deps, type Outcome } from "../src/conversation";
import { simulatedSender } from "../src/sender";
import { createMemoryStore } from "../src/store";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const BRANDS = ["mazda", "chevrolet", "renault", "toyota", "kia", "hyundai", "nissan", "ford", "volkswagen", "suzuki"];

/** Modelo de prueba: imita la salida JSON del modelo real a partir de palabras clave. */
function fakeModel(): LanguageModel & { calls: number } {
  const model = {
    calls: 0,
    async generateJson(messages: ModelMessage[]) {
      model.calls++;
      const last = messages.at(-1)?.content ?? "";
      const f = fold(last);
      const allUser = fold(messages.filter((m) => m.role === "user").map((m) => m.content).join("\n"));
      let intent = "otro";
      let confianza = "alta";
      let reply = "";
      if (/chocar|chocaron|accidente/.test(f)) [intent, reply] = ["accidente", "Lo siento mucho. Lo primero es tu seguridad."];
      else if (/reclam|no me ha pagado/.test(f)) [intent, reply] = ["reclamacion", "Entiendo tu situación y lamento lo ocurrido."];
      else if (/renov|vence/.test(f)) [intent, reply] = ["renovacion", "Antes de renovar podemos comparar opciones."];
      else if (/persona|humano/.test(f)) [intent, reply] = ["asesor_humano", "Claro."];
      else if (/cuanto (cuesta|vale)|precio/.test(f))
        // Respuesta con un precio INVENTADO: el sistema debe bloquearla.
        [intent, reply] = ["informacion", "Un todo riesgo para tu carro te sale en $1.850.000 al año."];
      else if (/que cubre|que es|como funciona/.test(f))
        [intent, reply] = [
          "informacion",
          "Un seguro todo riesgo puede incluir daños a tu vehículo y a terceros, según las condiciones de la póliza.",
        ];
      else if (/asdk|qwe|zzz/.test(f)) [intent, confianza, reply] = ["otro", "baja", "No entendí tu mensaje."];
      else if (/quiero|cotiz|asegurar|seguro|soy|me llamo|cedula|placa|particular|riesgo|\d{4}/.test(f))
        [intent, reply] = ["cotizacion", "¡Perfecto! 👍 Ya tomé nota."];
      else [intent, confianza, reply] = ["otro", "baja", "No estoy seguro de entenderte."];

      const insuranceType = /carro|vehiculo|moto|camioneta|mazda|toyota|fortuner|cx-5/.test(allUser)
        ? "vehiculos"
        : /vida/.test(allUser)
          ? "vida"
          : "ninguno";

      const datos: Record<string, string> = {};
      const tokens = last.split(/[\s,]+/);
      const b = tokens.findIndex((t) => BRANDS.includes(fold(t)));
      if (b >= 0) {
        datos.brand = tokens[b];
        if (tokens[b + 1] && !/^\d{4}$/.test(tokens[b + 1])) datos.model = tokens[b + 1];
      }
      const plate = last.match(/placa\s+(?:es\s+)?([A-Za-z0-9]+)/i);
      if (plate) datos.plate = plate[1];
      const year = last.match(/año\s+(?:es\s+)?(\d{4})/i);
      if (year) datos.year = year[1];
      return { reply, intent, confianza, insuranceType, datos, cobertura: "", uso: "", observaciones: "" };
    },
  };
  return model;
}

/* ─────────────────────────── utilidades ─────────────────────────── */

const store = createMemoryStore();
let failures = 0;
let checks = 0;
const results: Array<{ escenario: string; ok: boolean; detalle: string[] }> = [];

function newDeps(): Deps {
  return {
    store,
    models: singleModel(fakeModel()),
    sender: simulatedSender,
    defaultAdvisorId: null,
    siteUrl: "https://dyjvirtualseguros.com",
  };
}

let msgSeq = 0;
async function send(deps: Deps, from: string, text: string, messageId?: string): Promise<Outcome> {
  return handleIncoming(deps, { from, text, messageId: messageId ?? `sim-test-${++msgSeq}`, simulated: true });
}

/** Etiquetas con las que se pide cada dato en la lista "envíame…". */
const ASK: Record<string, RegExp> = {
  fullName: /• Nombre completo/,
  documentNumber: /• Número de identificación/,
  city: /• Ciudad/,
  phone: /• Celular/,
  plate: /• Placa/,
  vehicleType: /• Tipo de vehículo/,
  brand: /• Marca/,
  year: /• Año del modelo|año del vehículo/,
};

async function escenario(nombre: string, fn: (check: (cond: boolean, label: string) => void) => Promise<void>) {
  const detalle: string[] = [];
  let ok = true;
  const check = (cond: boolean, label: string) => {
    checks++;
    if (!cond) {
      ok = false;
      failures++;
      detalle.push(`✗ ${label}`);
    } else detalle.push(`✓ ${label}`);
  };
  try {
    await fn(check);
  } catch (error) {
    ok = false;
    failures++;
    detalle.push(`✗ excepción: ${error instanceof Error ? error.message : String(error)}`);
  }
  results.push({ escenario: nombre, ok, detalle });
}

/** Ninguna respuesta de recolección vuelve a pedir un dato que ya se conoce. */
function noRepeats(out: Outcome, check: (c: boolean, l: string) => void) {
  const text = out.replies.join("\n");
  for (const field of out.known) {
    const ask = ASK[field];
    if (ask) check(!ask.test(text), `no vuelve a pedir "${field}" (ya conocido)`);
  }
  check(out.known.every((k) => !out.missing.includes(k)), "conocidos y faltantes no se mezclan");
}

/* ─────────────────────────── escenarios ─────────────────────────── */

await escenario("1. Cotización de vehículo (inicio)", async (check) => {
  const out = await send(newDeps(), "573000000001", "Hola, quiero cotizar un seguro para mi carro");
  check(out.intent === "cotizacion", "intención: cotizacion");
  check(out.status === "bot", "estado: bot");
  check(out.missing.includes("fullName") && out.missing.includes("plate"), "identifica los datos que faltan");
  check(out.known.includes("phone"), "el celular se toma del número de WhatsApp");
  check(!/• Celular/.test(out.replies[0]), "no pide el celular");
  check(/en un solo mensaje/.test(out.replies[0]), "pide lo que falta agrupado, no uno por uno");
});

await escenario("2. Todos los datos en un mensaje + confirmación ACEPTO", async (check) => {
  const deps = newDeps();
  const from = "573000000002";
  const out = await send(
    deps,
    from,
    "Soy Carlos Pérez, cédula 1020304050, vivo en Bogotá, tengo una Mazda CX-5 2023 placa ABC123, uso particular, todo riesgo",
  );
  check(out.missing.length === 0, `no falta nada (faltan: ${out.missing.join(", ") || "—"})`);
  check(out.replies.length === 3, "envía confirmación + resumen + autorizaciones");
  check(/Revisa tu solicitud/.test(out.replies[1] ?? "") && /ABC123/.test(out.replies[1] ?? ""), "resumen con los datos");
  check(/responde ACEPTO/.test(out.replies[2] ?? ""), "pide ACEPTO para las autorizaciones A y B");
  const conv = store.state.conversations.find((c) => c.id === out.conversationId)!;
  check(conv.pendingAction === "confirmar_solicitud", "queda esperando confirmación");

  const ok = await send(deps, from, "Sí, acepto");
  check(/^SOL-[2-9A-HJ-NP-Z]{6}$/.test(ok.quoteReference ?? ""), `solicitud registrada (${ok.quoteReference})`);
  const req = store.state.quoteRequests.at(-1)!;
  check(req.submission.fullName === "Carlos Pérez" && req.submission.phone === "3000000002", "datos correctos en la solicitud");
  check(req.consent.source === "whatsapp" && req.consent.insurer_transfer === false, "consentimiento con origen whatsapp (C no se asume)");
  const consents = store.state.consents.filter((c) => c.conversationId === out.conversationId);
  check(consents.length === 2 && consents.every((c) => c.consentTextVersion.includes("pendiente")), "autorizaciones A y B registradas con su versión");
  const after = store.state.conversations.find((c) => c.id === out.conversationId)!;
  check(after.quoteRequestId === req.id && after.pendingAction === null, "la conversación queda vinculada a la solicitud");
});

let pocoAPocoConv = "";
await escenario("3. Datos poco a poco (sin repetir preguntas)", async (check) => {
  const deps = newDeps();
  const from = "573000000003";
  const steps = [
    "Quiero asegurar mi camioneta",
    "Me llamo Laura Gómez",
    "mi cédula es 52123456 y vivo en Medellín",
    "Es una Toyota Fortuner 2021, placa XYZ987",
    "particular, todo riesgo",
  ];
  let out: Outcome | null = null;
  for (const [i, text] of steps.entries()) {
    out = await send(deps, from, text);
    noRepeats(out, (c, l) => check(c, `paso ${i + 1}: ${l}`));
  }
  check(out!.missing.length === 0 && /responde ACEPTO/.test(out!.replies.at(-1) ?? ""), "al final tiene todo y pide confirmación");
  pocoAPocoConv = out!.conversationId!;
});

await escenario("4. Pregunta informativa", async (check) => {
  const out = await send(newDeps(), "573000000004", "¿Qué cubre un seguro todo riesgo?");
  check(out.intent === "informacion", "intención: informacion");
  check(out.status === "bot" && out.escalation === null, "responde de inmediato, sin escalar");
  check(/según las condiciones de la póliza/.test(out.replies[0]), "responde sin prometer coberturas exactas");
});

await escenario("5. Accidente (seguridad primero y a una persona)", async (check) => {
  const deps = newDeps();
  const from = "573000000005";
  const out = await send(deps, from, "Me acaban de chocar, hay un herido");
  check(out.intent === "accidente" && out.escalation === "accidente", "intención y escalamiento: accidente");
  check(out.status === "esperando_asesor", "estado: esperando_asesor");
  check(/123/.test(out.replies[0]), "indica la línea de emergencias 123");
  check(!/envíame|Nombre completo|Placa/.test(out.replies[0]), "NO pide datos de cotización");
  const next = await send(deps, from, "¿Me ayudan por favor?");
  check(next.replies.length === 0, "después de escalar, la IA ya no responde (espera al asesor)");
});

await escenario("6. Renovación", async (check) => {
  const out = await send(newDeps(), "573000000006", "Mi seguro del carro vence el próximo mes y quiero renovarlo");
  check(out.intent === "renovacion", "intención: renovacion");
  check(out.status === "bot" && out.missing.length > 0, "sigue la conversación pidiendo solo lo que falta");
  const conv = store.state.conversations.find((c) => c.id === out.conversationId)!;
  check(/Renovación/.test(conv.leadState.notes), "anota que es una renovación");
});

await escenario("7. Reclamación", async (check) => {
  const out = await send(newDeps(), "573000000007", "Quiero poner una reclamación, la aseguradora no me ha pagado");
  check(out.escalation === "reclamacion" && out.status === "esperando_asesor", "pasa a un asesor");
  check(/asesor de D&J continuará/.test(out.replies[0]), "avisa que un asesor continuará");
});

await escenario("8. “Quiero hablar con una persona”", async (check) => {
  const deps = newDeps();
  const from = "573000000008";
  await send(deps, from, "Quiero cotizar el seguro de mi moto");
  const out = await send(deps, from, "Quiero hablar con una persona");
  check(out.escalation === "asesor_humano" && out.status === "esperando_asesor", "detiene la automatización: esperando_asesor");
  const next = await send(deps, from, "hola?");
  check(next.replies.length === 0, "la IA ya no responde");
});

await escenario("9. Mensaje que la IA no entiende", async (check) => {
  const out = await send(newDeps(), "573000000009", "asdkj qwe zzz");
  check(out.escalation === "baja_confianza" && out.status === "esperando_asesor", "reconoce que no entiende y pasa a un asesor");
  check(/no estoy seguro/i.test(out.replies[0]), "lo dice con honestidad");
});

await escenario("10. Intento de obtener un precio", async (check) => {
  const out = await send(newDeps(), "573000000010", "¿Cuánto cuesta un todo riesgo para mi carro?");
  check(!/1\.850\.000/.test(out.replies.join(" ")), "bloquea el precio inventado por el modelo");
  check(/cotizar no significa contratar/i.test(out.replies[0]), "explica que el precio lo confirma la aseguradora");
});

await escenario("11. Datos inválidos", async (check) => {
  const deps = newDeps();
  const from = "573000000011";
  await send(deps, from, "Quiero cotizar mi carro, soy Pedro Ruiz");
  const out = await send(deps, from, "la placa es 12 y el año 1850");
  check(/Revisemos/.test(out.replies[0]), "explica qué datos revisar");
  check(!out.known.includes("plate") && !out.known.includes("year"), "no guarda los datos inválidos");
  check(out.known.includes("fullName"), "conserva los datos válidos anteriores");
});

await escenario("12. Información de salud", async (check) => {
  const out = await send(newDeps(), "573000000012", "Quiero un seguro de vida, soy Ana Ruiz, tengo diabetes, vivo en Cali");
  const inbound = store.state.messages.find((m) => m.conversationId === out.conversationId && m.direction === "entrante")!;
  check(out.healthRedacted && Boolean(inbound.healthRedacted), "el mensaje se marca como redactado");
  check(!/diabetes/i.test(inbound.body), "el dato de salud NO queda en el historial");
  check(inbound.body.includes(HEALTH_PLACEHOLDER) && /Ana Ruiz/.test(inbound.body) && /Cali/.test(inbound.body), "conserva el resto útil del mensaje");
  check(/🔒/.test(out.replies.join(" ")), "avisa al cliente que no guarda datos de salud");
  const conv = store.state.conversations.find((c) => c.id === out.conversationId)!;
  check(!/diabetes/i.test(JSON.stringify(conv.leadState)), "la solicitud no contiene datos de salud");
});

await escenario("13. Mensajes duplicados", async (check) => {
  const deps = newDeps();
  const from = "573000000013";
  const first = await send(deps, from, "Quiero cotizar mi carro", "sim-duplicado-1");
  const before = store.state.messages.length;
  const again = await send(deps, from, "Quiero cotizar mi carro", "sim-duplicado-1");
  check(!first.duplicate && again.duplicate, "el segundo se detecta como duplicado");
  check(store.state.messages.length === before && again.replies.length === 0, "no se guarda ni se responde dos veces");
});

await escenario("14. Continuación de una conversación anterior", async (check) => {
  const from = "573000000014";
  await send(newDeps(), from, "Quiero asegurar mi carro, me llamo Mario Díaz, cédula 79123456, vivo en Cali");
  // "Otro día": nueva instancia del modelo, misma base de datos.
  const out = await send(newDeps(), from, "Hola, sigo con lo del seguro: Toyota Corolla 2020 placa JKL321");
  check(["fullName", "documentNumber", "city"].every((f) => out.known.includes(f)), "recuerda nombre, cédula y ciudad");
  noRepeats(out, check);
  check(/Ya tengo/.test(out.replies[0]) && /Mario Díaz/.test(out.replies[0]), "le muestra lo que ya sabe");
});

await escenario("15. Seguridad del canal", async (check) => {
  const outbound = store.state.messages.filter((m) => m.direction === "saliente");
  check(outbound.length > 0 && outbound.every((m) => m.deliveryStatus === "simulado"), "ningún mensaje se envió de verdad (todos simulados)");
  check(store.state.messages.every((m) => m.isSimulated), "todos los mensajes quedan marcados como simulados");
  check(pocoAPocoConv.length > 0, "conversaciones persistidas");
});

await escenario("16. Canal web: mismo comportamiento que antes", async (check) => {
  const model = fakeModel();
  const base = { lead: EMPTY_LEAD, advisor: null, model, channel: "web" as const };
  const full = await runAssistantTurn({
    ...base,
    history: [
      {
        role: "user",
        content:
          "Soy Carlos Pérez, cédula 1020304050, celular 3001234567, vivo en Bogotá, Mazda CX-5 2023 placa ABC123, particular, todo riesgo",
      },
    ],
  });
  check(full.kind === "borrador" && full.draft !== null, "solicitud completa → tarjeta de confirmación");
  check(/pulsa «Enviar solicitud»/.test(full.reply), "mismo texto de la tarjeta de la web");
  const accident = await runAssistantTurn({ ...base, history: [{ role: "user", content: "Me acaban de chocar" }] });
  check(accident.escalation === "accidente" && /WhatsApp a cualquier hora/.test(accident.reply), "accidente: mismo mensaje con WhatsApp");
  const collect = await runAssistantTurn({ ...base, history: [{ role: "user", content: "Quiero cotizar mi carro" }] });
  check(collect.kind === "recoleccion" && /• Celular/.test(collect.reply), "en la web sí pide el celular (no hay número de WhatsApp)");
});

/* ─────────────────────────── informe ─────────────────────────── */

for (const r of results) {
  console.log(`${r.ok ? "PASA " : "FALLA"}  ${r.escenario}`);
  for (const d of r.detalle) console.log(`         ${d}`);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} escenarios · ${checks - failures}/${checks} comprobaciones`);
if (failures) process.exitCode = 1;
