import "server-only";

/**
 * ASESOR VIRTUAL — canal WEB
 * ──────────────────────────
 * Adaptador del chat de la web sobre el núcleo común del Asesor IA D&J (./core.ts),
 * que es el mismo que usa WhatsApp. Aquí solo se decide cómo se muestra el resultado:
 *   - borrador completo        → tarjeta de confirmación (quote_draft)
 *   - caso para una persona    → botón de WhatsApp (accidente, reclamación, pide un asesor, duda)
 *
 * El asistente web NO guarda nada. La solicitud la envía el cliente desde la tarjeta a
 * /api/quote-requests (source = "asistente_ia").
 */
import { siteConfig } from "@/config/site";
import type { ChatMessage, ChatResponse, LeadState } from "@/lib/chat";
import { getProduct } from "@/lib/insurance";
import type { Advisor } from "@/types";
import { AiError, getModelRouter, isWorkersAiAvailable } from "@/server/ai/workersAi";
import { runAssistantTurn } from "./core";

export { AiError };

/** ¿Se muestra el asesor virtual? Solo si Workers AI está disponible (Cloudflare o next dev con wrangler). */
export async function isAssistantAvailable(): Promise<boolean> {
  return isWorkersAiAvailable();
}

export async function replyToVisitor(
  history: ChatMessage[],
  lead: LeadState,
  advisor: Advisor | null,
): Promise<ChatResponse> {
  const models = await getModelRouter();
  if (!models) throw new AiError("Workers AI no está disponible.", "unavailable");

  const turn = await runAssistantTurn({ history, lead, advisor, models, channel: "web" });
  const { reply } = turn;
  const next = turn.lead;

  // ── Casos para una persona → botón de WhatsApp (asesor del enlace o el oficial) ──
  switch (turn.escalation) {
    case "accidente":
      return { lead: next, reply, action: { type: "whatsapp", message: "Hola, tuve un accidente y necesito orientación." } };
    case "reclamacion":
      return {
        lead: next,
        reply,
        action: { type: "whatsapp", message: "Hola, necesito ayuda con una reclamación de mi seguro." },
      };
    case "asesor_humano": {
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
    case "baja_confianza":
      return { lead: next, reply, action: { type: "whatsapp", message: siteConfig.whatsapp.defaultMessage } };
  }

  // ── Solicitud completa → tarjeta de confirmación ──
  if (turn.draft) return { lead: next, reply, action: { type: "quote_draft", draft: turn.draft } };

  return { lead: next, reply };
}
