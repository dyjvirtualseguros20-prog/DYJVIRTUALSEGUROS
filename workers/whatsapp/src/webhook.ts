/**
 * WEBHOOK DE META (WhatsApp Cloud API)
 * ────────────────────────────────────
 *   GET  /webhook  → verificación de Meta (hub.mode=subscribe + hub.verify_token = WHATSAPP_VERIFY_TOKEN)
 *   POST /webhook  → eventos. Solo se aceptan si la firma X-Hub-Signature-256 (HMAC-SHA256 del cuerpo
 *                    EXACTO con WHATSAPP_APP_SECRET) es válida; conocer la URL no basta.
 *
 * Del payload se toman:
 *   - messages        → mensajes de clientes (texto; los demás tipos con una marca, sin contenido)
 *   - message_echoes  → (coexistencia) lo que la empresa envía desde la app WhatsApp Business
 *   - statuses        → solo se cuentan (entregado/leído/fallido); no se guardan datos
 * Todo lo que no corresponda al número configurado (WHATSAPP_PHONE_NUMBER_ID) se ignora.
 */

/** Comparación en tiempo constante. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ¿La firma "sha256=…" corresponde al cuerpo exacto recibido? */
export async function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(`sha256=${hex}`, header.trim().toLowerCase());
}

/** GET /webhook: devuelve el challenge si el token coincide; si no, null (→ 403). */
export function verifyChallenge(url: URL, verifyToken: string): string | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || !verifyToken || !timingSafeEqual(token, verifyToken)) return null;
  return /^[A-Za-z0-9_-]{1,200}$/.test(challenge) ? challenge : null;
}

export type WaMessageType = "texto" | "audio" | "imagen" | "documento" | "interactivo" | "otro";

export interface MetaInbound {
  /** Número del cliente (wa_id, solo dígitos). */
  customer: string;
  name: string | null;
  text: string;
  /** wamid de Meta: identificador único para deduplicar. */
  messageId: string;
  /** Hora del mensaje en milisegundos (para ordenar). */
  sentAt: number | null;
  type: WaMessageType;
  /** true = eco: lo envió la empresa desde la app WhatsApp Business. */
  fromBusiness: boolean;
}

export interface ParsedWebhook {
  messages: MetaInbound[];
  statuses: { sent: number; delivered: number; read: number; failed: number; failedCodes: number[] };
  ignored: number;
}

const TYPE: Record<string, WaMessageType> = {
  text: "texto",
  audio: "audio",
  voice: "audio",
  image: "imagen",
  sticker: "imagen",
  video: "documento",
  document: "documento",
  interactive: "interactivo",
  button: "interactivo",
};

/** Lo que se guarda de un mensaje que no es texto (nunca su contenido). */
const PLACEHOLDER: Record<WaMessageType, string> = {
  texto: "",
  audio: "[El cliente envió un audio]",
  imagen: "[El cliente envió una imagen]",
  documento: "[El cliente envió un archivo]",
  interactivo: "[Respuesta de botón]",
  otro: "[Mensaje de un tipo no compatible]",
};

function readMessage(m: Record<string, unknown>, fromBusiness: boolean): Omit<MetaInbound, "customer" | "name"> | null {
  const id = typeof m.id === "string" ? m.id : "";
  if (!id || m.type === "reaction" || m.type === "revoke" || m.type === "edit" || m.type === "system") return null;
  const type = TYPE[String(m.type)] ?? "otro";
  let text = PLACEHOLDER[type];
  if (type === "texto") text = String((m.text as { body?: unknown })?.body ?? "");
  // Respuesta de un botón: su texto sí se puede leer.
  if (type === "interactivo") {
    const i = m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
    const b = m.button as { text?: string } | undefined;
    text = i?.button_reply?.title ?? i?.list_reply?.title ?? b?.text ?? text;
  }
  const ts = Number(m.timestamp);
  return {
    text: text.slice(0, 4000),
    messageId: id.slice(0, 180),
    sentAt: Number.isFinite(ts) && ts > 0 ? ts * 1000 : null,
    // Un botón con texto se trata como texto; el resto, por su tipo.
    type: type === "interactivo" && text !== PLACEHOLDER.interactivo ? "texto" : type,
    fromBusiness,
  };
}

/** Lee el payload de Meta. Solo eventos del número configurado (`phoneNumberId`). */
export function parseMetaPayload(payload: unknown, phoneNumberId: string): ParsedWebhook {
  const out: ParsedWebhook = {
    messages: [],
    statuses: { sent: 0, delivered: 0, read: 0, failed: 0, failedCodes: [] },
    ignored: 0,
  };
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      if (!phoneNumberId || metadata?.phone_number_id !== phoneNumberId) {
        out.ignored++;
        continue;
      }
      const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) ?? [];
      for (const m of (value.messages as Array<Record<string, unknown>>) ?? []) {
        const customer = String(m.from ?? "").replace(/\D/g, "");
        const read = readMessage(m, false);
        if (!read || !/^[0-9]{8,15}$/.test(customer)) continue;
        out.messages.push({
          ...read,
          customer,
          name: contacts.find((c) => c.wa_id === customer)?.profile?.name ?? null,
        });
      }
      for (const m of (value.message_echoes as Array<Record<string, unknown>>) ?? []) {
        const customer = String(m.to ?? "").replace(/\D/g, "");
        const read = readMessage(m, true);
        if (!read || !/^[0-9]{8,15}$/.test(customer)) continue;
        out.messages.push({ ...read, customer, name: null });
      }
      for (const s of (value.statuses as Array<{ status?: string; errors?: Array<{ code?: number }> }>) ?? []) {
        if (s.status === "sent") out.statuses.sent++;
        else if (s.status === "delivered") out.statuses.delivered++;
        else if (s.status === "read") out.statuses.read++;
        else if (s.status === "failed") {
          out.statuses.failed++;
          for (const e of s.errors ?? []) if (typeof e.code === "number") out.statuses.failedCodes.push(e.code);
        }
      }
    }
  }
  return out;
}

/** Número enmascarado para los logs: 5730****4567. Nunca se registra completo. */
export const maskNumber = (n: string) => (n.length > 6 ? `${n.slice(0, 4)}****${n.slice(-4)}` : "****");

/** Lista de números del piloto (secreto WHATSAPP_PILOT_NUMBERS, separados por coma). */
export const pilotNumbers = (raw: string | undefined) =>
  new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((n) => n.replace(/\D/g, ""))
      .filter((n) => /^[0-9]{8,15}$/.test(n)),
  );

/* ─────────────────────────────── Manejador HTTP ─────────────────────────────── */

/** Lo que el webhook necesita de la configuración del Worker (secretos incluidos). */
export interface WebhookEnv {
  WHATSAPP_MODE: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_PILOT_NUMBERS?: string;
}

/** Mensaje que se entrega a la fila del cliente (Durable Object). */
export interface WebhookEnqueue {
  from: string;
  name: string | null;
  text: string;
  messageId: string;
  sentAt: number | null;
  simulated: false;
  options: Record<string, string>;
  wait: false;
}

/** Cuerpo máximo aceptado del webhook (los eventos de texto pesan pocos KB). */
const MAX_WEBHOOK_BYTES = 256 * 1024;

/**
 * GET/POST /webhook. `enqueue` entrega cada mensaje a la fila de su cliente (en el Worker, el
 * Durable Object). Se responde 200 sin esperar a la IA; si la fila falla, 500 y Meta reintenta
 * (los duplicados se descartan por wamid en la fila y en la base de datos).
 */
export async function handleWebhook(
  req: Request,
  env: WebhookEnv,
  enqueue: (customer: string, msg: WebhookEnqueue) => Promise<unknown>,
): Promise<Response> {
  if (env.WHATSAPP_MODE !== "piloto" && env.WHATSAPP_MODE !== "produccion")
    return new Response("Not found", { status: 404 });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const challenge = verifyChallenge(url, env.WHATSAPP_VERIFY_TOKEN ?? "");
    return challenge
      ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
      : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Not found", { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_WEBHOOK_BYTES) return new Response("Payload too large", { status: 413 });
  // Sin firma válida no se procesa nada (conocer la URL no basta).
  if (!(await verifyMetaSignature(env.WHATSAPP_APP_SECRET ?? "", raw, req.headers.get("x-hub-signature-256")))) {
    console.warn("[webhook] firma inválida o ausente");
    return new Response("Unauthorized", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = parseMetaPayload(payload, env.WHATSAPP_PHONE_NUMBER_ID ?? "");
  const pilot = env.WHATSAPP_MODE === "piloto" ? pilotNumbers(env.WHATSAPP_PILOT_NUMBERS) : null;
  const accepted = parsed.messages.filter((m) => !pilot || pilot.has(m.customer));
  const skipped = parsed.messages.length - accepted.length;

  await Promise.all(
    accepted.map((m) =>
      enqueue(m.customer, {
        from: m.customer,
        name: m.name,
        text: m.text,
        messageId: m.messageId,
        sentAt: m.sentAt,
        simulated: false,
        options: {
          canal: "meta",
          ...(m.fromBusiness ? { eco: "1" } : {}),
          ...(m.type !== "texto" ? { tipo: m.type } : {}),
        },
        wait: false,
      }),
    ),
  );

  if (accepted.length || skipped || parsed.statuses.failed)
    console.log("[webhook]", {
      mensajes: accepted.length,
      ecos: accepted.filter((m) => m.fromBusiness).length,
      fueraDelPiloto: skipped,
      clientes: [...new Set(accepted.map((m) => maskNumber(m.customer)))],
      estados: parsed.statuses,
    });
  return new Response("OK", { status: 200 });
}
