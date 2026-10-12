import type { AiBinding } from "@/server/ai/model";

/** Configuración del Worker dyj-whatsapp. Los secretos nunca se escriben en el código ni en los logs. */
export interface Env {
  /** Workers AI (binding, sin claves). */
  AI: AiBinding;
  /**
   * Hyperdrive → Supabase con el rol wa_bot (permisos mínimos). Las credenciales viven cifradas
   * en la configuración de Hyperdrive "dyj-whatsapp-db" (caché desactivada), no en el código.
   */
  HYPERDRIVE: Hyperdrive;
  /** Fila ordenada por cliente (Durable Object, una instancia por número). */
  CONVERSATION_QUEUE: DurableObjectNamespace<import("./queue-do").ConversationQueue>;
  /** SECRETO: clave que protege POST /simular. */
  SIMULATION_KEY: string;
  /**
   * "simulacion": solo /simular (sin WhatsApp real).
   * "piloto":     /webhook activo, pero la IA SOLO atiende los números de WHATSAPP_PILOT_NUMBERS;
   *               los demás mensajes se ignoran por completo (ni se guardan ni se responden) y los
   *               sigue atendiendo la persona en la app WhatsApp Business.
   * "produccion": la IA atiende a todos los clientes que escriban.
   */
  WHATSAPP_MODE: string;
  /** Asesor al que se asignan las conversaciones nuevas ("" = sin asesor, como en la web). */
  DEFAULT_ADVISOR_ID: string;
  /** Dirección pública de la web (para los enlaces a la política y los términos). */
  SITE_URL: string;
  /** Opcional: otro modelo de Workers AI. */
  WORKERS_AI_MODEL?: string;
  /** Versión de la Graph API de Meta para enviar mensajes (p. ej. "v23.0"). */
  WHATSAPP_GRAPH_VERSION: string;
  // ── SECRETOS de Meta (con `wrangler secret put`; nunca en el código, Git ni los logs) ──
  /** SECRETO: App Secret de la app de Meta (firma X-Hub-Signature-256). */
  WHATSAPP_APP_SECRET?: string;
  /** SECRETO: token que se escribe también en Meta al configurar el webhook. */
  WHATSAPP_VERIFY_TOKEN?: string;
  /** SECRETO: token de acceso (usuario del sistema) con whatsapp_business_messaging. */
  WHATSAPP_ACCESS_TOKEN?: string;
  /** SECRETO: identificador del número en Cloud API (no es el número de teléfono). */
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** SECRETO: números autorizados en modo piloto (solo dígitos, separados por coma). */
  WHATSAPP_PILOT_NUMBERS?: string;
}
