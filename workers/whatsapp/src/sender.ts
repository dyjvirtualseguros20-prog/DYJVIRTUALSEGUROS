/**
 * ENVÍO DE MENSAJES
 * En esta fase SOLO existe el envío simulado: no hay ninguna llamada a la API de WhatsApp,
 * así que es imposible enviar un mensaje real. El envío por Cloud API se agregará al conectar Meta.
 */
export interface OutboundSender {
  send(to: string, text: string): Promise<{ status: "simulado" | "enviado" | "fallido"; externalId?: string }>;
}

export const simulatedSender: OutboundSender = {
  async send() {
    return { status: "simulado" };
  },
};
