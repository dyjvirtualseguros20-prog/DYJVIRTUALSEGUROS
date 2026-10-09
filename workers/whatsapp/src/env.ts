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
  /** SECRETO: clave que protege POST /simular. */
  SIMULATION_KEY: string;
  /** "simulacion" en esta fase: no se reciben ni se envían mensajes reales. */
  WHATSAPP_MODE: string;
  /** Asesor al que se asignan las conversaciones nuevas ("" = sin asesor, como en la web). */
  DEFAULT_ADVISOR_ID: string;
  /** Dirección pública de la web (para los enlaces a la política y los términos). */
  SITE_URL: string;
  /** Opcional: otro modelo de Workers AI. */
  WORKERS_AI_MODEL?: string;
  // ── Fase real (todavía NO se usan; se configurarán al conectar Meta) ──
  // WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
}
