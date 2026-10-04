/**
 * POST /api/quotes
 * ────────────────
 * Backend de esta aplicación (se ejecuta en el servidor).
 * 1. Valida de nuevo los datos con los mismos esquemas del formulario.
 * 2. Delega en server/quoteProvider.ts, que hoy usa MOCK y mañana tu API propia.
 *
 * Los datos personales no se guardan en el navegador ni en este servidor:
 * la persistencia será responsabilidad de la API propia y su base de datos.
 */
import { NextResponse } from "next/server";
import { quoteApiBodySchema } from "@/lib/validation/quoteSchemas";
import { requestQuotes } from "@/server/quoteProvider";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const parsed = quoteApiBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // path: ["form", "campo"]
      const key = String(issue.path[1] ?? issue.path[0] ?? "_form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Revisa los campos marcados.", fieldErrors }, { status: 422 });
  }

  try {
    const data = await requestQuotes(parsed.data.insuranceType, parsed.data.form);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/quotes]", error);
    return NextResponse.json(
      { error: "No fue posible obtener cotizaciones en este momento. Escríbenos por WhatsApp." },
      { status: 502 },
    );
  }
}
