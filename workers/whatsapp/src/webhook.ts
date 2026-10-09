/**
 * WEBHOOK DE META (preparado, NO conectado)
 * ─────────────────────────────────────────
 * Funciones para la fase real: verificación de la firma X-Hub-Signature-256 con el App Secret
 * y lectura de los mensajes de texto del payload de WhatsApp Cloud API.
 * En la fase de simulación la ruta /webhook NO existe (index.ts responde 404).
 */
import type { Incoming } from "./conversation";

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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(`sha256=${hex}`, header);
}

/** Mensajes de texto del payload de Meta (los demás tipos se agregarán en la fase de multimedia). */
export function parseMetaPayload(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) ?? [];
      for (const m of (value.messages as Array<Record<string, unknown>>) ?? []) {
        if (m.type !== "text") continue;
        const from = String(m.from ?? "");
        out.push({
          from,
          name: contacts.find((c) => c.wa_id === from)?.profile?.name ?? null,
          text: String((m.text as { body?: string })?.body ?? ""),
          messageId: String(m.id ?? ""),
          simulated: false,
        });
      }
    }
  }
  return out;
}
