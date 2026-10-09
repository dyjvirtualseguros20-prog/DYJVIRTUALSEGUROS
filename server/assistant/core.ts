import "server-only";

/**
 * NÚCLEO DEL ASESOR IA D&J (común a todos los canales: web y WhatsApp)
 * ────────────────────────────────────────────────────────────────────
 *   mensaje del cliente + LeadState (lo que ya se sabe de esta conversación)
 *     └─► modelo (JSON): respuesta + intención + confianza + datos del último mensaje
 *           └─► anclaje: solo datos que el cliente escribió, validados con las reglas de los formularios
 *                 ├─ accidente / reclamación / pide una persona / confianza baja → ESCALAR a un asesor
 *                 ├─ faltan datos       → UN mensaje agrupado ("Ya tengo… / Envíame…"), sin repetir lo conocido
 *                 ├─ solicitud completa → BORRADOR para que el cliente confirme
 *                 └─ pregunta           → RESPUESTA inmediata (solo con información real)
 *
 * El núcleo NO guarda nada ni sabe de botones: cada canal (web: server/assistant/index.ts,
 * WhatsApp: workers/whatsapp) decide cómo mostrar el resultado y qué persistir.
 */
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { cleanText, type ChatMessage, type LeadState, type QuoteDraft } from "@/lib/chat";
import type { Advisor } from "@/types";
import type { LanguageModel, ModelMessage } from "@/server/ai/model";
import { groupedRequest } from "./collect";
import {
  asksForHuman,
  containsHealthData,
  groundedData,
  looksLikeName,
  obviousCity,
  obviousData,
  obviousExtras,
  obviousName,
  obviousNumbers,
  obviousOptions,
  reportsAccidentNow,
  trimPunctuation,
  unsafeClaim,
  vehicleTypeFromLine,
} from "./grounding";
import { assistantFields, buildQuoteDraft, evaluateLead, isInsuranceType, isLeadComplete, mergeLead, missingExtras } from "./lead";
import { INTENTS, RESPONSE_SCHEMA, systemPrompt, type AssistantChannel, type Intent } from "./prompt";

export type { AssistantChannel, Intent };

/** Mensajes recientes que se envían al modelo (lo anterior ya está resumido en LeadState). */
export const HISTORY_WINDOW = 12;
const MAX_OUTPUT_TOKENS = 800;

/** Por qué una conversación debe pasar a una persona. */
export type EscalationReason = "accidente" | "reclamacion" | "asesor_humano" | "baja_confianza";

export interface AssistantTurnInput {
  /** Historial reciente; el último mensaje es del cliente. */
  history: ChatMessage[];
  /** Lo que ya se sabe de la solicitud en esta conversación. */
  lead: LeadState;
  advisor: Advisor | null;
  model: LanguageModel;
  channel: AssistantChannel;
  /**
   * El canal ya ocultó datos de salud del último mensaje antes de guardarlo (WhatsApp).
   * El dato no llega al modelo, pero el cliente debe recibir igual el aviso de privacidad.
   */
  healthDataRedacted?: boolean;
}

export interface AssistantTurn {
  reply: string;
  lead: LeadState;
  intent: Intent;
  confidence: "alta" | "media" | "baja";
  /**
   * respuesta  → información que se pudo responder de inmediato
   * recoleccion → se pidieron (agrupados) los datos que faltan
   * borrador   → ya están todos los datos: el cliente debe confirmar
   * escalar    → el caso debe pasar a una persona (ver `escalation`)
   */
  kind: "respuesta" | "recoleccion" | "borrador" | "escalar";
  escalation: EscalationReason | null;
  /** Datos que ya se conocen (nombres internos, más "coverage"/"useType"). */
  known: string[];
  /** Datos obligatorios que todavía faltan. */
  missing: string[];
  draft: QuoteDraft | null;
  /** El último mensaje traía datos de salud (no se guardaron en la solicitud). */
  healthMentioned: boolean;
}

const modelOutput = z.object({
  reply: z.string().catch(""),
  // "cotizar" era el nombre anterior de "cotizacion".
  intent: z.preprocess((v) => (v === "cotizar" ? "cotizacion" : v), z.enum(INTENTS)).catch("otro"),
  confianza: z.enum(["alta", "media", "baja"]).catch("media"),
  insuranceType: z.string().catch("ninguno"),
  datos: z.record(z.string(), z.unknown()).catch({}),
  observaciones: z.string().catch(""),
  cobertura: z.string().catch(""),
  uso: z.string().catch(""),
});

function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Limpia el texto del modelo (sin markdown ni enlaces: los botones los pone el sistema). */
function tidyReply(text: string): string {
  return cleanText(
    text
      // Algunos modelos devuelven las tildes escapadas (á en lugar de á).
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^#+\s*/gm, "")
      .replace(/https?:\/\/\S+/g, ""),
  ).slice(0, 1200);
}

/** Respuesta completa del modelo sin las preguntas finales (los datos se piden en la lista agrupada). */
function withoutQuestions(reply: string): string {
  const kept = reply.split(/(?<=[.!?])\s+/).filter((s) => s && !s.includes("?") && !s.includes("¿"));
  return kept.join(" ").trim() || "¡Con gusto! 👍";
}

/** Frase de confirmación del modelo, sin preguntas (las preguntas las arma el sistema agrupadas). */
function acknowledgment(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/).filter((s) => s && !s.includes("?") && !s.includes("¿"));
  const ack = sentences.slice(0, 2).join(" ").trim();
  return ack || "¡Perfecto! 👍";
}

/** Texto libre (cobertura, uso) solo si el cliente lo escribió. */
function groundedText(value: string, userText: string): string {
  const text = trimPunctuation(cleanText(value)).slice(0, 120);
  if (!text) return "";
  const compact = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return compact(userText).includes(compact(text)) ? text : "";
}

/** Orientación mínima garantizada ante un accidente (somos una agencia: la asistencia la presta la aseguradora). */
function accidentReply(modelReply: string, channel: AssistantChannel): string {
  let reply = modelReply;
  if (!/123/.test(reply))
    reply = `Mantén la calma. Si hay personas lesionadas o peligro, llama de inmediato a la línea de emergencias 123. ${reply}`;
  if (!/aseguradora/i.test(reply)) reply += " Luego comunícate con tu aseguradora y sigue el procedimiento de tu póliza.";
  if (channel === "web") {
    if (!/whatsapp/i.test(reply))
      reply += " También puedes escribirle a tu asesor por WhatsApp a cualquier hora para recibir orientación.";
  } else {
    reply += " Ya le avisé a un asesor de D&J para que te acompañe por este mismo chat.";
  }
  if (!/agencia/i.test(reply))
    reply += " Recuerda que somos una agencia que te orienta: la asistencia del siniestro la presta tu aseguradora.";
  return reply;
}

/** Mensaje al pasar el caso a una persona (en la web, el botón de WhatsApp lo agrega el canal). */
function escalationReply(reason: Exclude<EscalationReason, "accidente">, modelReply: string, channel: AssistantChannel) {
  if (channel === "web") {
    if (reason === "asesor_humano") return modelReply;
    if (reason === "reclamacion")
      return `${modelReply} Un asesor revisará tu caso con atención: escríbele por WhatsApp para continuar.`.trim();
    return "No quiero darte información incorrecta y no estoy seguro de haber entendido tu mensaje. Un asesor puede ayudarte por WhatsApp.";
  }
  const schedule = siteConfig.contact.schedule;
  const handoff = `Un asesor de D&J continuará esta conversación por este mismo chat${schedule ? ` (horario de atención: ${schedule})` : ""}.`;
  if (reason === "asesor_humano") return `Claro 👍 Te comunico con una persona. ${handoff}`;
  if (reason === "reclamacion") return `${modelReply ? `${modelReply} ` : ""}${handoff}`.trim();
  return `No quiero darte información incorrecta y no estoy seguro de haber entendido tu mensaje. ${handoff}`;
}

const DRAFT_REPLY: Record<AssistantChannel, string> = {
  web: "Perfecto 👍 Ya tengo la información necesaria para solicitar tu cotización. ¿Está todo correcto? Si es así, acepta la política de datos y pulsa «Enviar solicitud». Si algo no está bien, escríbeme qué cambiar.",
  whatsapp: "Perfecto 👍 Ya tengo la información necesaria para solicitar tu cotización.",
};

/** Un turno de conversación: interpreta el último mensaje y decide qué hacer. No guarda nada. */
export async function runAssistantTurn(input: AssistantTurnInput): Promise<AssistantTurn> {
  const { history, lead, advisor, model, channel } = input;
  const recent = history.slice(-HISTORY_WINDOW);
  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt(advisor, bogotaToday(), lead, channel) },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];
  const output = modelOutput.parse(await model.generateJson(messages, RESPONSE_SCHEMA, MAX_OUTPUT_TOKENS));

  // ── Actualizar el estado del cliente con TODO lo que escribió (nunca datos inventados) ──
  const userText = recent
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const lastMessage = history.at(-1)?.content ?? "";

  // Señales inequívocas del cliente que mandan sobre la lectura del modelo.
  let intent: Intent = output.intent;
  if (reportsAccidentNow(lastMessage)) intent = "accidente";
  else if (asksForHuman(lastMessage)) intent = "asesor_humano";

  const type = isInsuranceType(output.insuranceType) ? output.insuranceType : lead.insuranceType;
  const fromModel = groundedData(output.datos, userText);
  const known = { ...lead.fields, ...fromModel };
  const missingNow = type ? new Set(evaluateLead(type, known).missing.map((f) => f.name)) : new Set<string>();
  const extracted = {
    ...obviousNumbers(lastMessage, missingNow),
    ...obviousData(lastMessage, type),
    ...fromModel,
  };
  const datos: Record<string, string> = {
    ...obviousOptions(userText, type, { ...lead.fields, ...extracted }),
    ...extracted,
  };
  // Un "nombre" que no parece nombre propio se descarta, venga del modelo o del texto.
  if (datos.fullName && !looksLikeName(datos.fullName)) delete datos.fullName;
  // Nombre: si el modelo no lo vio (o solo tomó una palabra), se usa el que se reconoce en el texto.
  const name = obviousName(lastMessage);
  // Tipo de vehículo por la línea conocida (CX-5 → Camioneta / SUV), solo si falta.
  if (type === "vehiculos" && !datos.vehicleType && !lead.fields.vehicleType) {
    const byLine = vehicleTypeFromLine(userText);
    if (byLine) datos.vehicleType = byLine;
  }
  // Ciudad: igual, si falta y el cliente nombró una.
  const city = obviousCity(lastMessage);
  if (city && !datos.city && !lead.fields.city) datos.city = city;
  // Nunca reemplaza un nombre válido que ya se tenía.
  if (name && !lead.fields.fullName && (!datos.fullName || datos.fullName.split(/\s+/).length < 2))
    datos.fullName = name;
  const extras = obviousExtras(userText);
  const coverage = groundedText(output.cobertura, userText) || extras.coverage;
  const useType = groundedText(output.uso, userText) || extras.useType;

  // Datos de salud (sensibles): nunca se guardan en la solicitud.
  const healthMentioned = containsHealthData(lastMessage) || Boolean(input.healthDataRedacted);
  let observaciones = containsHealthData(output.observaciones) ? "" : output.observaciones;
  if (intent === "renovacion" && !/renovaci/i.test(lead.notes))
    observaciones = observaciones ? `Renovación de póliza. ${observaciones}` : "Renovación de póliza";

  const { lead: next, rejected } = mergeLead(lead, {
    insuranceType: output.insuranceType,
    datos,
    observaciones,
    coverage,
    useType,
  });

  const knownNames = [
    ...Object.keys(next.fields),
    ...(next.coverage ? ["coverage"] : []),
    ...(next.useType ? ["useType"] : []),
  ];
  const missingNames = next.insuranceType
    ? [...evaluateLead(next.insuranceType, next.fields).missing.map((f) => f.name), ...missingExtras(next)]
    : [];
  const base = {
    lead: next,
    intent,
    confidence: output.confianza,
    known: knownNames,
    missing: missingNames,
    draft: null,
    healthMentioned,
  } satisfies Omit<AssistantTurn, "reply" | "kind" | "escalation">;

  let reply = tidyReply(output.reply) || "¿Me cuentas un poco más para poder ayudarte?";
  // Nunca: pólizas aprobadas o emitidas, garantías, "la mejor aseguradora" ni precios inventados.
  if (unsafeClaim(reply, userText)) {
    reply =
      "Te cuento con transparencia: cotizar no significa contratar. Los precios, la aprobación y la emisión de la póliza solo los confirma la aseguradora, y un asesor te los informará.";
  }
  // Aviso que se agrega al final de cualquier respuesta si el cliente mencionó datos de salud.
  const healthNote = healthMentioned
    ? "🔒 Por tu privacidad, no guardo información de salud en tu solicitud; si la aseguradora la necesita, un asesor te la pedirá por separado y con tu autorización."
    : "";
  if (healthNote) reply = `${reply} ${healthNote}`;

  // ── Casos que pasan a una persona: la seguridad y la atención humana van antes que los datos ──
  if (intent === "accidente")
    return { ...base, reply: accidentReply(reply, channel), kind: "escalar", escalation: "accidente" };
  if (intent === "asesor_humano" || intent === "reclamacion")
    return { ...base, reply: escalationReply(intent, reply, channel), kind: "escalar", escalation: intent };

  // ── Recolección de datos: agrupada, sin repetir lo que ya se sabe ──
  const givingData = Object.keys(datos).length > 0 || Object.keys(rejected).length > 0 || Boolean(coverage || useType);
  // "Quiero un seguro de vida", "necesito asegurar…": intención de cotizar aunque el modelo la vea como pregunta.
  const wantsInsurance = /\b(quiero|quisiera|necesito|cotiz\w*|me interesa|asegurar|busco|renovar)\b/i.test(lastMessage);

  // Sin datos ni intención de cotizar y el modelo no está seguro: no se adivina, se pasa a una persona.
  if (output.confianza === "baja" && !givingData && (intent === "otro" || intent === "informacion"))
    return {
      ...base,
      reply: escalationReply("baja_confianza", reply, channel),
      kind: "escalar",
      escalation: "baja_confianza",
    };

  if (next.insuranceType && (intent === "cotizacion" || intent === "renovacion" || givingData || wantsInsurance)) {
    const { missing } = evaluateLead(next.insuranceType, next.fields);

    // Completa (todo lo obligatorio) → borrador para confirmar.
    if (isLeadComplete(next)) {
      const draft = buildQuoteDraft(next);
      if (draft) return { ...base, draft, reply: DRAFT_REPLY[channel], kind: "borrador", escalation: null };
    }

    const { required, optional } = assistantFields(next.insuranceType);
    const labels = new Map([...required, ...optional].map((f) => [f.name, f.label]));
    const corrections = Object.entries(rejected).map(([field, message]) => `${labels.get(field) ?? field}: ${message}`);
    // Si el cliente hizo una pregunta, se responde completa antes de la lista; si no, solo una confirmación.
    const leadIn = intent === "informacion" ? withoutQuestions(reply) : acknowledgment(reply);
    const grouped = groupedRequest(leadIn, next, missing, corrections);
    return {
      ...base,
      reply: healthNote ? `${grouped}\n\n${healthNote}` : grouped,
      kind: "recoleccion",
      escalation: null,
    };
  }

  return { ...base, reply, kind: "respuesta", escalation: null };
}
