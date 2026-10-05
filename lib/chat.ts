import { z } from "zod";
import { INSURANCE_TYPES, type InsuranceType } from "@/types";

/**
 * ASESOR VIRTUAL (chat con IA) — tipos y reglas compartidas entre el navegador y el servidor.
 *
 *   ChatWidget ─► POST /api/chat ─► server/assistant.ts ─► Anthropic (Claude Haiku 4.5)
 *        │
 *        └─ tarjeta de confirmación ─► POST /api/quote-requests (source = "asistente_ia")
 *
 * La conversación vive solo en la memoria de la página: no se guarda en el navegador
 * ni en la base de datos. Solo se guarda la solicitud cuando el cliente la confirma.
 */

/** Límites de uso (también se aplican en el servidor). */
export const CHAT_LIMITS = {
  /** Caracteres por mensaje del visitante. */
  maxUserChars: 1000,
  /** Caracteres por respuesta del asistente que el navegador reenvía como historial. */
  maxAssistantChars: 2000,
  /** Mensajes por conversación (visitante + asistente). */
  maxMessages: 30,
  /** Mensajes por visitante (IP) en la ventana de tiempo. */
  maxPerWindow: 20,
  windowMs: 10 * 60_000,
} as const;

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Datos de cotización que preparó el asistente (sin validar el consentimiento: lo da el cliente en la tarjeta). */
export interface QuoteDraft {
  insuranceType: InsuranceType;
  /** Valores en texto, tal como los recibe el formulario. El servidor los vuelve a validar. */
  form: Record<string, string>;
  notes?: string;
  /** Resumen legible para la tarjeta de confirmación. */
  summary: Array<{ label: string; value: string }>;
}

export type ChatAction = { type: "quote_draft"; draft: QuoteDraft } | { type: "whatsapp"; message: string };

export interface ChatResponse {
  reply: string;
  action?: ChatAction;
  /** "mock" = respuestas de prueba locales; "missing" = falta ANTHROPIC_API_KEY (desarrollo). */
  mode?: "live" | "mock" | "missing";
}

/** Quita caracteres de control y espacios sobrantes. */
export function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cuerpo de POST /api/chat. Alterna visitante/asistente y termina con un mensaje del visitante. */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().transform(cleanText),
      }),
    )
    .min(1)
    .max(CHAT_LIMITS.maxMessages)
    .superRefine((messages, ctx) => {
      messages.forEach((m, i) => {
        const expected: ChatRole = i % 2 === 0 ? "user" : "assistant";
        const max = m.role === "user" ? CHAT_LIMITS.maxUserChars : CHAT_LIMITS.maxAssistantChars;
        if (m.role !== expected) ctx.addIssue({ code: "custom", message: "Orden de mensajes no válido.", path: [i] });
        if (!m.content) ctx.addIssue({ code: "custom", message: "Mensaje vacío.", path: [i] });
        if (m.content.length > max) ctx.addIssue({ code: "custom", message: "Mensaje demasiado largo.", path: [i] });
      });
      if (messages.at(-1)?.role !== "user")
        ctx.addIssue({ code: "custom", message: "Falta el mensaje del visitante." });
    }),
});

/** Botones rápidos del saludo. `prompt` es lo que se envía como mensaje del visitante. */
export const QUICK_OPTIONS: Array<{ label: string; prompt?: string; type?: InsuranceType }> = [
  { label: "🚗 Vehículos", prompt: "Quiero un seguro para mi vehículo", type: "vehiculos" },
  { label: "❤️ Vida", prompt: "Quiero un seguro de vida", type: "vida" },
  { label: "🏠 Hogar", prompt: "Quiero un seguro de hogar", type: "hogar" },
  { label: "🏥 Salud", prompt: "Quiero un seguro de salud", type: "salud" },
  { label: "✈️ Viajes", prompt: "Quiero un seguro de viaje", type: "viajes" },
  { label: "🏢 Empresas", prompt: "Quiero un seguro para mi empresa", type: "empresas" },
  { label: "💬 Tengo una pregunta" },
];

export const isInsuranceTypeValue = (value: unknown): value is InsuranceType =>
  typeof value === "string" && (INSURANCE_TYPES as readonly string[]).includes(value);
