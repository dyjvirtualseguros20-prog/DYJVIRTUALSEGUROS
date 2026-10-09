/**
 * Sustituto de server/ai/workersAi.ts SOLO para las pruebas (se inyecta al empaquetar las pruebas).
 * Permite probar el adaptador web real (server/assistant/index.ts) sin Cloudflare ni Workers AI.
 * El modelo de prueba se entrega a través del ENRUTADOR REAL (server/ai/router.ts) con un
 * proveedor "prueba", así las pruebas web también ejercitan la capa de modelos.
 */
import type { LanguageModel } from "@/server/ai/model";
import { createModelRouter, memoryUsageSink, type ModelRouter } from "@/server/ai/router";

export { AiError, DEFAULT_MODEL, type LanguageModel, type ModelMessage } from "@/server/ai/model";

let current: LanguageModel | null = null;

/** Uso registrado por el enrutador durante las pruebas web. */
export const testUsage = memoryUsageSink(500);

/** La prueba decide qué modelo "existe" (null = Workers AI no disponible). */
export function setTestModel(model: LanguageModel | null) {
  current = model;
}

export async function isWorkersAiAvailable(): Promise<boolean> {
  return current !== null;
}

export async function getLanguageModel(): Promise<LanguageModel | null> {
  return current;
}

export async function getModelRouter(): Promise<ModelRouter | null> {
  if (!current) return null;
  const model = current;
  const route = { provider: "prueba", model: "modelo-de-prueba" };
  return createModelRouter({
    providers: [{ id: "prueba", create: () => model }],
    routes: { rapido: route, razonamiento: route, resumen: route, extraccion: route },
    sink: testUsage,
  });
}
