/**
 * POST /api/quote-requests
 * ────────────────────────
 * Recibe el formulario del cotizador, lo valida de nuevo en el servidor y guarda
 * la solicitud (Supabase) con el estado "Nueva solicitud".
 * Solo devuelve la referencia: nunca datos de otras solicitudes.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADVISOR_COOKIE } from "@/lib/advisorLink";
import { quoteApiBodySchema, quoteRequestExtrasSchema } from "@/lib/validation/quoteSchemas";
import { createQuoteRequest, StorageNotConfiguredError } from "@/server/quoteRequests";

// Límite básico contra envíos masivos: 5 solicitudes por IP cada 10 minutos (por instancia).
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Recibimos varias solicitudes seguidas. Espera unos minutos o escríbenos por WhatsApp." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const parsed = quoteApiBodySchema.safeParse(body);
  const extras = quoteRequestExtrasSchema.safeParse(body);
  if (!parsed.success || !extras.success) {
    if (parsed.success) return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[1] ?? issue.path[0] ?? "_form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Revisa los campos marcados.", fieldErrors }, { status: 422 });
  }

  try {
    // Asesor de la visita: se toma de la cookie que fijó el enlace (/cristian), nunca del formulario.
    // La base de datos vuelve a comprobar que exista y esté activo.
    const advisorId = (await cookies()).get(ADVISOR_COOKIE)?.value ?? null;
    const receipt = await createQuoteRequest(parsed.data.insuranceType, parsed.data.form, advisorId, extras.data);
    return NextResponse.json({ receipt }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/quote-requests]", error);
    const message =
      error instanceof StorageNotConfiguredError
        ? "El registro de solicitudes no está disponible en este momento. Escríbenos por WhatsApp."
        : "No pudimos registrar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
