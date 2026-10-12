/**
 * ENVÍO DE MENSAJES
 *   simulatedSender → /simular: NUNCA llama a Meta (imposible enviar un mensaje real).
 *   createCloudSender → mensajes que llegaron por el webhook real: WhatsApp Cloud API oficial
 *     (POST /{PHONE_NUMBER_ID}/messages). Reintenta solo errores transitorios (red, 429, 5xx).
 *     Un error de Meta (p. ej. fuera de la ventana de 24 h) devuelve "fallido" con su código;
 *     el mensaje queda guardado como fallido y visible en /admin.
 *   El token nunca se registra; en los logs solo van el código HTTP y el código de error de Meta.
 */
export interface SendResult {
  status: "simulado" | "enviado" | "fallido";
  /** wamid que asigna Meta al mensaje enviado. */
  externalId?: string;
  /** Código de error de Meta (o HTTP) si falló. */
  errorCode?: number;
}

export interface OutboundSender {
  /** true = envía mensajes reales por WhatsApp. */
  readonly real: boolean;
  send(to: string, text: string): Promise<SendResult>;
}

export const simulatedSender: OutboundSender = {
  real: false,
  async send() {
    return { status: "simulado" };
  },
};

export interface CloudSenderConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Versión de la Graph API (variable WHATSAPP_GRAPH_VERSION). */
  graphVersion: string;
  fetch?: typeof fetch;
  /** Esperas entre reintentos (ms). */
  retryDelays?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const MAX_TEXT = 4096;

export function createCloudSender(config: CloudSenderConfig): OutboundSender {
  const doFetch = config.fetch ?? fetch;
  const delays = config.retryDelays ?? [1000, 3000];
  const sleep = config.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const url = `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  return {
    real: true,
    async send(to, text) {
      if (!config.accessToken || !config.phoneNumberId) return { status: "fallido", errorCode: 0 };
      const body = JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, MAX_TEXT) },
      });
      let lastCode = 0;
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        let res: Response;
        try {
          res = await doFetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
            body,
          });
        } catch {
          lastCode = -1; // red
          if (attempt < delays.length) await sleep(delays[attempt]);
          continue;
        }
        const data = (await res.json().catch(() => null)) as {
          messages?: Array<{ id?: string }>;
          error?: { code?: number };
        } | null;
        if (res.ok && data?.messages?.[0]?.id) return { status: "enviado", externalId: data.messages[0].id };
        lastCode = data?.error?.code ?? res.status;
        // Transitorio: límite de velocidad o error del servidor de Meta → se reintenta.
        const transient =
          res.status === 429 || res.status >= 500 || lastCode === 4 || lastCode === 80007 || lastCode === 130429;
        console.warn("[whatsapp] envío fallido", { http: res.status, meta: lastCode, intento: attempt + 1 });
        if (!transient) break;
        if (attempt < delays.length) await sleep(delays[attempt]);
      }
      return { status: "fallido", errorCode: lastCode };
    },
  };
}
