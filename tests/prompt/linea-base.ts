/**
 * LÍNEA BASE DEL PROMPT (tamaño que se envía al modelo en cada mensaje)
 * Mide el prompt del sistema actual por canal y lo compara con tests/linea-base-prompt.json.
 * Los tokens son una ESTIMACIÓN (caracteres / 3,5); no se usa un tokenizador real ni la IA.
 *   node tests/run-tests.mjs --registrar-linea-base   → guarda la medición como nueva línea base
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { EMPTY_LEAD, type LeadState } from "@/lib/chat";
import { systemPrompt } from "@/server/assistant/prompt";
import { prueba } from "../harness";

const CHARS_PER_TOKEN = 3.5;

const LEAD_EJEMPLO: LeadState = {
  insuranceType: "vehiculos",
  fields: { fullName: "Prueba Uno", documentNumber: "1020304050", city: "Bogotá", plate: "ABC123", year: "2023" },
  coverage: "Todo riesgo",
  useType: "Particular",
  notes: "",
};

function medir() {
  const out: Record<string, { caracteres: number; tokens_estimados: number }> = {};
  for (const channel of ["web", "whatsapp"] as const) {
    for (const [nombre, lead] of [
      ["sin_datos", EMPTY_LEAD],
      ["con_datos", LEAD_EJEMPLO],
    ] as const) {
      const p = systemPrompt(null, "2026-01-01", lead, channel);
      out[`${channel}_${nombre}`] = { caracteres: p.length, tokens_estimados: Math.round(p.length / CHARS_PER_TOKEN) };
    }
  }
  return out;
}

export async function pruebaLineaBase(archivo: string, registrar: boolean) {
  const actual = medir();
  if (registrar || !existsSync(archivo)) {
    writeFileSync(
      archivo,
      `${JSON.stringify(
        {
          descripcion:
            "Tamaño del prompt del sistema por mensaje (Fase 2, paso 2.1). Tokens estimados = caracteres / 3,5.",
          medido_en: new Date().toISOString().slice(0, 10),
          medicion: actual,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Línea base del prompt registrada en ${archivo.replace(/\\/g, "/").split("/").slice(-2).join("/")}`);
  }
  const base = JSON.parse(readFileSync(archivo, "utf8")) as { medicion: typeof actual };

  await prueba("Prompt. Tamaño frente a la línea base", async (check) => {
    for (const [clave, v] of Object.entries(actual)) {
      const b = base.medicion[clave];
      const delta = b ? v.caracteres - b.caracteres : 0;
      console.log(
        `   prompt ${clave.padEnd(20)} ${String(v.caracteres).padStart(6)} caracteres · ~${String(v.tokens_estimados).padStart(5)} tokens` +
          (b ? ` · cambio ${delta >= 0 ? "+" : ""}${delta}` : " · sin línea base"),
      );
      check(Boolean(b), `existe línea base para ${clave}`);
    }
    // Los dos canales comparten el mismo conocimiento: la diferencia debe ser solo el texto del canal.
    check(
      Math.abs(actual.web_sin_datos.caracteres - actual.whatsapp_sin_datos.caracteres) < 400,
      "web y WhatsApp usan el mismo conocimiento base",
    );
  });
}
