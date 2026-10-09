import type { LanguageModel } from "@/server/ai/model";

/**
 * Modelo de PRUEBA DE CONEXIÓN (sin IA): permite verificar Worker → Hyperdrive → Supabase
 * sin consumir el cupo de Workers AI. Solo se usa en /simular cuando se pide `"modelo": "prueba"`.
 */
export const connectionTestModel: LanguageModel = {
  async generateJson() {
    return {
      reply: "Prueba de conexión: mensaje recibido y guardado.",
      intent: "informacion",
      confianza: "alta",
      insuranceType: "ninguno",
      datos: {},
      cobertura: "",
      uso: "",
      observaciones: "",
    };
  },
};
