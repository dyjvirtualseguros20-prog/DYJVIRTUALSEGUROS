/**
 * POST /api/chat — Asesor virtual (IA)
 * ────────────────────────────────────
 * Recibe la conversación reciente y el estado de la solicitud (LeadState), los valida y
 * responde con Cloudflare Workers AI desde el servidor (binding env.AI, sin claves).
 * El asistente NO guarda solicitudes: devuelve un borrador que el cliente confirma
 * en la tarjeta y que se envía a /api/quote-requests (source = "asistente_ia").
 */
import { NextResponse } from "next/server";
import { CHAT_LIMITS, chatRequestSchema, type ChatResponse } from "@/lib/chat";
import { getCurrentAdvisor } from "@/server/advisors";
import { AiError, replyToVisitor } from "@/server/assistant";
import { clientIp, rateLimited } from "@/server/rateLimit";

const json = (body: ChatResponse | { error: string }, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Solo peticiones del propio sitio (el navegador envía Origin en los POST).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: "Origen no permitido." }, 403);
  }

  if (await rateLimited("chat", clientIp(request), CHAT_LIMITS.maxPerWindow, CHAT_LIMITS.windowMs)) {
    return json({ error: "Enviaste muchos mensajes seguidos. Espera unos minutos o escríbenos por WhatsApp." }, 429);
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 80_000) return json({ error: "Conversación demasiado larga." }, 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.code === "too_big" && i.path.length === 1);
    return json(
      {
        error: tooMany
          ? "Esta conversación llegó a su límite. Reinicia el chat o escríbenos por WhatsApp."
          : "No pudimos procesar tu mensaje. Revisa que no supere los 1.000 caracteres.",
      },
      tooMany ? 413 : 400,
    );
  }

  try {
    // Asesor de la visita: el de la cookie del enlace (/cristian, /jeisson…). El chat no puede cambiarlo.
    const advisor = await getCurrentAdvisor();
    return json(await replyToVisitor(parsed.data.messages, parsed.data.lead, advisor));
  } catch (error) {
    const kind = error instanceof AiError ? error.kind : "failed";
    if (!(error instanceof AiError)) console.error("[api/chat]", error);
    return json(
      {
        error:
          kind === "busy"
            ? "El asesor virtual está muy ocupado en este momento. Inténtalo de nuevo en un minuto o escríbenos por WhatsApp."
            : "El asesor virtual no está disponible en este momento. Puedes escribirnos por WhatsApp o usar el formulario de cotización.",
      },
      503,
    );
  }
}
