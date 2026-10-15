/**
 * PRUEBAS DEL CANAL WEB (red de seguridad, paso 2.1)
 * ─────────────────────────────────────────────────
 * Ejercitan el adaptador real de la web (server/assistant/index.ts → replyToVisitor) con un
 * modelo de prueba que devuelve exactamente el JSON indicado en cada caso. Fijan el
 * comportamiento actual (formato de ChatResponse, botones de WhatsApp, tarjeta de confirmación,
 * protecciones) para detectar cualquier cambio en los siguientes pasos de la Fase 2.
 * No usan Cloudflare, Workers AI ni Supabase.
 */
import { siteConfig } from "@/config/site";
import { chatRequestSchema, EMPTY_LEAD, type ChatMessage, type ChatResponse, type LeadState } from "@/lib/chat";
import { getProduct } from "@/lib/insurance";
import { AiError, type LanguageModel } from "@/server/ai/model";
import { replyToVisitor } from "@/server/assistant";
import { setTestModel } from "../fakes/workersAi";
import { prueba, type Check } from "../harness";

/** Salida del modelo para un caso (los campos que falten toman valores neutros). */
type ModelOut = Partial<{
  reply: string;
  intent: string;
  confianza: string;
  insuranceType: string;
  datos: Record<string, string>;
  observaciones: string;
  cobertura: string;
  uso: string;
}>;

/** Modelo de prueba: devuelve la salida indicada y registra cuántas veces se llamó. */
function scripted(out: ModelOut): LanguageModel & { calls: number } {
  const model = {
    calls: 0,
    async generateJson() {
      model.calls++;
      return {
        reply: "",
        intent: "otro",
        confianza: "alta",
        insuranceType: "ninguno",
        datos: {},
        observaciones: "",
        cobertura: "",
        uso: "",
        ...out,
      };
    },
  };
  return model;
}

const user = (content: string): ChatMessage[] => [{ role: "user", content }];

async function turn(out: ModelOut, text: string, lead: LeadState = EMPTY_LEAD): Promise<ChatResponse> {
  setTestModel(scripted(out));
  return replyToVisitor(user(text), lead, null);
}

const COMPLETO =
  "Soy Carlos Pérez, cédula 1020304050, celular 3001234567, vivo en Bogotá, Mazda CX-5 2023 placa ABC123, particular, todo riesgo";

export async function pruebasAdaptadorWeb() {
  await prueba("Web 1. Pregunta informativa → respuesta sin botón", async (check: Check) => {
    const r = await turn(
      { intent: "informacion", reply: "Un todo riesgo puede incluir daños propios y a terceros, según la póliza." },
      "¿Qué es un todo riesgo?",
    );
    check(r.action === undefined, "sin acción");
    check(r.reply.startsWith("Un todo riesgo puede incluir"), "devuelve la respuesta del modelo");
    check(Object.keys(r.lead.fields).length === 0 && r.lead.insuranceType === null, "no inventa datos del cliente");
    // Comportamiento existente: la cobertura que el cliente nombra («todo riesgo») se anota como interés.
    check(r.lead.coverage === "Todo riesgo", "anota la cobertura que el cliente escribió (comportamiento actual)");
  });

  await prueba("Web 2. Solicitud completa → tarjeta de confirmación", async (check) => {
    const r = await turn(
      { intent: "cotizacion", insuranceType: "vehiculos", reply: "¡Perfecto!", datos: { brand: "Mazda", model: "CX-5" } },
      COMPLETO,
    );
    check(r.action?.type === "quote_draft", "acción quote_draft");
    check(
      r.reply ===
        "Perfecto 👍 Ya tengo la información necesaria para solicitar tu cotización. ¿Está todo correcto? Si es así, acepta la política de datos y pulsa «Enviar solicitud». Si algo no está bien, escríbeme qué cambiar.",
      "texto exacto de la tarjeta",
    );
    const draft = r.action?.type === "quote_draft" ? r.action.draft : null;
    check(draft?.insuranceType === "vehiculos", "tipo de seguro: vehículos");
    check(draft?.form.plate === "ABC123" && draft?.form.documentNumber === "1020304050", "placa y cédula en el formulario");
    check(draft?.form.phone === "3001234567", "celular en el formulario");
    check(Boolean(draft?.summary.some((s) => s.value.includes("Mazda CX-5"))), "resumen con el vehículo");
  });

  await prueba("Web 3. Faltan datos → lista agrupada (la web sí pide el celular)", async (check) => {
    const r = await turn(
      { intent: "cotizacion", insuranceType: "vehiculos", reply: "¡Perfecto! 👍" },
      "Quiero cotizar el seguro de mi carro",
    );
    check(r.action === undefined, "sin acción");
    check(/Para solicitar tu cotización, envíame en un solo mensaje/.test(r.reply), "pide los datos en un solo mensaje");
    check(/• Celular \(WhatsApp\)/.test(r.reply), "incluye el celular");
    check(r.lead.insuranceType === "vehiculos", "recuerda el tipo de seguro");
  });

  await prueba("Web 4. No vuelve a pedir lo que ya sabe", async (check) => {
    const lead: LeadState = {
      ...EMPTY_LEAD,
      insuranceType: "vehiculos",
      fields: { fullName: "Laura Gómez", documentNumber: "52123456", city: "Medellín" },
    };
    const r = await turn({ intent: "cotizacion", insuranceType: "vehiculos", reply: "¡Listo!" }, "mi celular es 3109876543", lead);
    check(/Ya tengo/.test(r.reply) && /Laura Gómez/.test(r.reply), "muestra lo que ya tiene");
    check(!/• Nombre completo|• Número de identificación|• Ciudad|• Celular/.test(r.reply), "no repite nombre, cédula, ciudad ni celular");
    check(r.lead.fields.phone === "3109876543", "guarda el celular nuevo");
  });

  await prueba("Web 5. Accidente → orientación + botón de WhatsApp", async (check) => {
    const r = await turn({ intent: "accidente", reply: "Lo siento mucho." }, "Me acaban de chocar");
    check(r.action?.type === "whatsapp", "botón de WhatsApp");
    check(r.action?.type === "whatsapp" && r.action.message === "Hola, tuve un accidente y necesito orientación.", "mensaje del botón");
    check(/123/.test(r.reply) && /WhatsApp a cualquier hora/.test(r.reply), "menciona el 123 y WhatsApp");
    check(!/envíame|Nombre completo/.test(r.reply), "no pide datos de cotización");
  });

  await prueba("Web 6. Pide una persona → botón con el producto", async (check) => {
    const lead: LeadState = { ...EMPTY_LEAD, insuranceType: "vehiculos" };
    const r = await turn({ intent: "asesor_humano", reply: "Claro, con gusto." }, "Quiero hablar con una persona", lead);
    const esperado = `Hola, quiero hablar con un asesor sobre un ${getProduct("vehiculos").name.toLowerCase()}.`;
    check(r.action?.type === "whatsapp" && r.action.message === esperado, "mensaje con el producto");
    check(r.reply === "Claro, con gusto.", "respuesta del modelo sin cambios");
  });

  await prueba("Web 7. Pide una persona sin producto → mensaje general", async (check) => {
    const r = await turn({ intent: "asesor_humano", reply: "Claro." }, "Quiero hablar con un asesor");
    check(r.action?.type === "whatsapp" && r.action.message === siteConfig.whatsapp.defaultMessage, "mensaje predeterminado");
  });

  await prueba("Web 8. Reclamación → botón de WhatsApp", async (check) => {
    const r = await turn({ intent: "reclamacion", reply: "Lamento lo ocurrido." }, "La aseguradora no me ha pagado el siniestro");
    check(
      r.action?.type === "whatsapp" && r.action.message === "Hola, necesito ayuda con una reclamación de mi seguro.",
      "mensaje de reclamación",
    );
    check(/Un asesor revisará tu caso/.test(r.reply), "avisa que un asesor revisará");
  });

  await prueba("Web 9. Confianza baja → no adivina, botón de WhatsApp", async (check) => {
    const r = await turn({ intent: "otro", confianza: "baja", reply: "No sé." }, "asdkj qwe");
    check(r.action?.type === "whatsapp" && r.action.message === siteConfig.whatsapp.defaultMessage, "botón general");
    check(/no estoy seguro de haber entendido/i.test(r.reply), "lo reconoce con honestidad");
  });

  await prueba("Web 10. Precio inventado por el modelo → bloqueado", async (check) => {
    const r = await turn(
      { intent: "informacion", reply: "Ese seguro te cuesta $1.850.000 al año." },
      "¿Cuánto cuesta un todo riesgo?",
    );
    check(!/1\.850\.000/.test(r.reply), "no muestra el precio");
    check(/cotizar no significa contratar/i.test(r.reply), "explica que lo confirma la aseguradora");
  });

  await prueba("Web 11. Póliza «aprobada» inventada → bloqueada", async (check) => {
    const r = await turn({ intent: "informacion", reply: "Tu póliza ya está aprobada." }, "¿Ya quedé asegurado?");
    check(!/aprobada/i.test(r.reply), "no afirma aprobación");
  });

  await prueba("Web 12. Datos de salud → aviso y no se guardan", async (check) => {
    const r = await turn(
      { intent: "cotizacion", insuranceType: "vida", reply: "¡Perfecto!", observaciones: "tiene diabetes" },
      "Quiero un seguro de vida, soy Ana Ruiz, tengo diabetes",
    );
    check(/🔒/.test(r.reply), "aviso de privacidad");
    check(!/diabetes/i.test(JSON.stringify(r.lead)), "la salud no queda en los datos");
  });

  await prueba("Web 13. Intención antigua «cotizar» se sigue entendiendo", async (check) => {
    const r = await turn({ intent: "cotizar", insuranceType: "vehiculos", reply: "¡Perfecto!" }, "Quiero cotizar mi carro");
    check(/en un solo mensaje/.test(r.reply), "se trata como cotización");
  });

  await prueba("Web 14. Datos que el cliente no escribió → descartados", async (check) => {
    const r = await turn(
      { intent: "cotizacion", insuranceType: "vehiculos", reply: "¡Perfecto!", datos: { year: "2019", plate: "XYZ999" } },
      "Quiero cotizar mi carro",
    );
    check(!r.lead.fields.year && !r.lead.fields.plate, "no acepta año ni placa inventados");
  });

  await prueba("Web 15. Errores de la IA → mismo tipo de error que hoy", async (check) => {
    setTestModel({
      async generateJson() {
        throw new AiError("límite diario", "busy");
      },
    });
    let kind = "";
    try {
      await replyToVisitor(user("hola"), EMPTY_LEAD, null);
    } catch (e) {
      kind = e instanceof AiError ? e.kind : "otro";
    }
    check(kind === "busy", "IA ocupada → AiError busy (la ruta responde 503)");

    setTestModel(null);
    kind = "";
    try {
      await replyToVisitor(user("hola"), EMPTY_LEAD, null);
    } catch (e) {
      kind = e instanceof AiError ? e.kind : "otro";
    }
    check(kind === "unavailable", "IA no disponible → AiError unavailable");
  });

  await prueba("Web 16. Contrato de /api/chat (esquema de la petición)", async (check) => {
    const ok = chatRequestSchema.safeParse({ messages: [{ role: "user", content: "hola" }] });
    check(ok.success, "acepta un mensaje del visitante");
    const mal = chatRequestSchema.safeParse({
      messages: [
        { role: "assistant", content: "hola" },
        { role: "user", content: "x" },
      ],
    });
    check(!mal.success, "rechaza un orden de mensajes no válido");
    const largo = chatRequestSchema.safeParse({ messages: [{ role: "user", content: "a".repeat(1001) }] });
    check(!largo.success, "rechaza mensajes de más de 1.000 caracteres");
  });
}
