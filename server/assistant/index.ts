import "server-only";

/**
 * ASESOR VIRTUAL — orquestador (servidor)
 * ─────────────────────────────────────────
 *   mensaje del cliente + LeadState
 *     └─► Workers AI (JSON): respuesta + intención + datos del último mensaje
 *           └─► mergeLead(): valida cada dato con las reglas de los formularios
 *                 ├─ faltan datos       → UN mensaje agrupado: "Ya tengo… / Envíame en un solo mensaje…"
 *                 │                       (incluye los datos con error, explicados)
 *                 ├─ solicitud completa → tarjeta de confirmación (quote_draft)
 *                 └─ accidente / pide una persona → botón de WhatsApp
 *
 * El asistente NO guarda nada. La solicitud la envía el cliente desde la tarjeta a
 * /api/quote-requests (source = "asistente_ia"). Cuando existan las APIs de las
 * aseguradoras, se conectarán sobre la solicitud guardada (ver server/insurers).
 */
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { cleanText, type ChatMessage, type ChatResponse, type LeadState } from "@/lib/chat";
import { getProduct } from "@/lib/insurance";
import type { Advisor } from "@/types";
import { AiError, getLanguageModel, isWorkersAiAvailable, type ModelMessage } from "@/server/ai/workersAi";
import { groupedRequest } from "./collect";
import {
  groundedData,
  obviousData,
  obviousExtras,
  obviousCity,
  looksLikeName,
  obviousName,
  obviousNumbers,
  obviousOptions,
  trimPunctuation,
  vehicleTypeFromLine,
} from "./grounding";
import { assistantFields, buildQuoteDraft, evaluateLead, isInsuranceType, isLeadComplete, mergeLead } from "./lead";
import { RESPONSE_SCHEMA, systemPrompt } from "./prompt";

export { AiError };

/** Mensajes recientes que se envían al modelo (lo anterior ya está resumido en LeadState). */
const HISTORY_WINDOW = 12;
const MAX_OUTPUT_TOKENS = 800;

/** ¿Se muestra el asesor virtual? Solo si Workers AI está disponible (Cloudflare o next dev con wrangler). */
export async function isAssistantAvailable(): Promise<boolean> {
  return isWorkersAiAvailable();
}

const modelOutput = z.object({
  reply: z.string().catch(""),
  intent: z.enum(["cotizar", "informacion", "accidente", "asesor_humano", "otro"]).catch("otro"),
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

export async function replyToVisitor(
  history: ChatMessage[],
  lead: LeadState,
  advisor: Advisor | null,
): Promise<ChatResponse> {
  const model = await getLanguageModel();
  if (!model) throw new AiError("Workers AI no está disponible.", "unavailable");

  const recent = history.slice(-HISTORY_WINDOW);
  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt(advisor, bogotaToday(), lead) },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];
  const output = modelOutput.parse(await model.generateJson(messages, RESPONSE_SCHEMA, MAX_OUTPUT_TOKENS));

  // ── Actualizar el estado del cliente con TODO lo que escribió (nunca datos inventados) ──
  const userText = recent
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const lastMessage = history.at(-1)?.content ?? "";
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

  const { lead: next, rejected } = mergeLead(lead, {
    insuranceType: output.insuranceType,
    datos,
    observaciones: output.observaciones,
    coverage,
    useType,
  });
  const reply = tidyReply(output.reply) || "¿Me cuentas un poco más para poder ayudarte?";

  // ── Accidente o pide hablar con una persona → botón de WhatsApp (asesor del enlace o el oficial) ──
  if (output.intent === "accidente") return { lead: next, ...accidentReply(reply) };
  if (output.intent === "asesor_humano") {
    const product = next.insuranceType ? getProduct(next.insuranceType).name.toLowerCase() : null;
    return {
      lead: next,
      reply,
      action: {
        type: "whatsapp",
        message: product
          ? `Hola, quiero hablar con un asesor sobre un ${product}.`
          : siteConfig.whatsapp.defaultMessage,
      },
    };
  }

  // ── Recolección de datos: agrupada, sin repetir lo que ya se sabe ──
  const givingData = Object.keys(datos).length > 0 || Object.keys(rejected).length > 0 || Boolean(coverage || useType);
  // "Quiero un seguro de vida", "necesito asegurar…": intención de cotizar aunque el modelo la vea como pregunta.
  const wantsInsurance = /\b(quiero|quisiera|necesito|cotiz\w*|me interesa|asegurar|busco)\b/i.test(lastMessage);
  if (next.insuranceType && (output.intent === "cotizar" || givingData || wantsInsurance)) {
    const { missing } = evaluateLead(next.insuranceType, next.fields);

    // Completa (todo lo obligatorio) → tarjeta de confirmación directamente.
    if (isLeadComplete(next)) {
      const draft = buildQuoteDraft(next);
      if (draft) {
        return {
          lead: next,
          reply:
            "Perfecto 👍 Ya tengo la información necesaria para solicitar tu cotización. ¿Está todo correcto? Si es así, acepta la política de datos y pulsa «Enviar solicitud». Si algo no está bien, escríbeme qué cambiar.",
          action: { type: "quote_draft", draft },
        };
      }
    }

    const { required, optional } = assistantFields(next.insuranceType);
    const labels = new Map([...required, ...optional].map((f) => [f.name, f.label]));
    const corrections = Object.entries(rejected).map(([name, message]) => `${labels.get(name) ?? name}: ${message}`);
    // Si el cliente hizo una pregunta, se responde completa antes de la lista; si no, solo una confirmación.
    const leadIn = output.intent === "informacion" ? withoutQuestions(reply) : acknowledgment(reply);
    return { lead: next, reply: groupedRequest(leadIn, next, missing, corrections) };
  }

  return { lead: next, reply };
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
function accidentReply(modelReply: string): Pick<ChatResponse, "reply" | "action"> {
  let reply = modelReply;
  if (!/123/.test(reply))
    reply = `Mantén la calma. Si hay personas lesionadas o peligro, llama de inmediato a la línea de emergencias 123. ${reply}`;
  if (!/aseguradora/i.test(reply))
    reply += " Luego comunícate con tu aseguradora y sigue el procedimiento de tu póliza.";
  if (!/whatsapp/i.test(reply))
    reply += " También puedes escribirle a tu asesor por WhatsApp a cualquier hora para recibir orientación.";
  if (!/agencia/i.test(reply))
    reply += " Recuerda que somos una agencia que te orienta: la asistencia del siniestro la presta tu aseguradora.";
  return { reply, action: { type: "whatsapp", message: "Hola, tuve un accidente y necesito orientación." } };
}
