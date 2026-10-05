import "server-only";

/**
 * ASESOR VIRTUAL — orquestador (servidor)
 * ─────────────────────────────────────────
 *   mensaje del cliente + LeadState
 *     └─► Workers AI (JSON): respuesta + intención + datos del último mensaje
 *           └─► mergeLead(): valida cada dato con las reglas de los formularios
 *                 ├─ datos con error   → se piden de nuevo (mensaje del sistema)
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
import { groundedData, obviousData, obviousOptions } from "./grounding";
import { buildQuoteDraft, evaluateLead, fieldsFor, isInsuranceType, mergeLead } from "./lead";
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

export async function replyToVisitor(
  history: ChatMessage[],
  lead: LeadState,
  advisor: Advisor | null,
): Promise<ChatResponse> {
  const model = await getLanguageModel();
  if (!model) throw new AiError("Workers AI no está disponible.", "unavailable");

  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt(advisor, bogotaToday(), lead) },
    ...history.slice(-HISTORY_WINDOW).map((m) => ({ role: m.role, content: m.content })),
  ];
  const output = modelOutput.parse(await model.generateJson(messages, RESPONSE_SCHEMA, MAX_OUTPUT_TOKENS));

  // Solo se aceptan datos que el cliente escribió; además se rescatan correo, celular y placa.
  const recent = history.slice(-HISTORY_WINDOW);
  const userText = recent
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const type = isInsuranceType(output.insuranceType) ? output.insuranceType : lead.insuranceType;
  const extracted = { ...obviousData(history.at(-1)?.content ?? "", type), ...groundedData(output.datos, userText) };
  const datos = { ...obviousOptions(userText, type, { ...lead.fields, ...extracted }), ...extracted };

  const { lead: next, rejected } = mergeLead(lead, {
    insuranceType: output.insuranceType,
    datos,
    observaciones: output.observaciones,
  });
  let reply = tidyReply(output.reply) || "¿Me cuentas un poco más para poder ayudarte?";

  // 1) Datos que no pasaron la validación: se piden de nuevo con el mensaje exacto del formulario.
  const rejectedNames = Object.keys(rejected);
  if (next.insuranceType && rejectedNames.length) {
    const labels = new Map(fieldsFor(next.insuranceType).map((f) => [f.name, f.label]));
    const problems = rejectedNames.map((n) => `${labels.get(n) ?? n}: ${rejected[n]}`).join(" ");
    return { lead: next, reply: `Revisemos un dato 🙂 ${problems} ¿Me lo confirmas, por favor?` };
  }

  // 2) Accidente o pide hablar con una persona → botón de WhatsApp (asesor del enlace o el oficial).
  if (output.intent === "accidente") {
    // Orientación mínima garantizada (somos una agencia: la asistencia la presta la aseguradora).
    if (!/123/.test(reply))
      reply = `Mantén la calma. Si hay personas lesionadas o peligro, llama de inmediato a la línea de emergencias 123. ${reply}`;
    if (!/aseguradora/i.test(reply))
      reply += " Luego comunícate con tu aseguradora y sigue el procedimiento de tu póliza.";
    if (!/whatsapp/i.test(reply))
      reply += " También puedes escribirle a tu asesor por WhatsApp a cualquier hora para recibir orientación.";
    if (!/agencia/i.test(reply))
      reply += " Recuerda que somos una agencia que te orienta: la asistencia del siniestro la presta tu aseguradora.";
    return {
      lead: next,
      reply,
      action: { type: "whatsapp", message: "Hola, tuve un accidente y necesito orientación." },
    };
  }
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

  // 3) Solicitud completa → tarjeta de confirmación.
  if (next.insuranceType && evaluateLead(next.insuranceType, next.fields).missing.length === 0) {
    const draft = buildQuoteDraft(next);
    if (draft) {
      reply =
        "¡Perfecto! Ya tengo todos los datos. Revisa el resumen, acepta la política de datos y pulsa «Enviar solicitud». Un asesor preparará tu cotización comparando opciones.";
      return { lead: next, reply, action: { type: "quote_draft", draft } };
    }
  }

  // 4) Faltan datos y el cliente está cotizando: si la respuesta no pide nada, se pide el siguiente dato.
  if (
    next.insuranceType &&
    output.intent === "cotizar" &&
    !reply.includes("?") &&
    !/necesit|compart|indica|dime/i.test(reply)
  ) {
    const nextField = evaluateLead(next.insuranceType, next.fields).missing[0];
    if (nextField) reply = `${reply} ${ASK[nextField.name] ?? `¿Me indicas ${nextField.label.toLowerCase()}?`}`;
  }

  return { lead: next, reply };
}

/** Pregunta natural para pedir cada dato cuando el modelo no lo hizo. */
const ASK: Record<string, string> = {
  fullName: "¿Me compartes tu nombre completo?",
  phone: "¿Cuál es tu número de celular?",
  email: "¿Cuál es tu correo electrónico?",
  city: "¿En qué ciudad vives?",
  documentNumber: "¿Cuál es tu número de cédula?",
  birthDate: "¿Cuál es tu fecha de nacimiento?",
  plate: "¿Cuál es la placa del vehículo?",
  vehicleType: "¿Qué tipo de vehículo es: automóvil, camioneta, campero, pickup, moto u otro?",
  brand: "¿De qué marca es el vehículo?",
  model: "¿Qué modelo o línea es?",
  year: "¿De qué año es el modelo?",
};
