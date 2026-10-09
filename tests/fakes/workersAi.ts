/**
 * Sustituto de server/ai/workersAi.ts SOLO para las pruebas (se inyecta al empaquetar las pruebas).
 * Permite probar el adaptador web real (server/assistant/index.ts) sin Cloudflare ni Workers AI.
 */
import type { LanguageModel } from "@/server/ai/model";

export { AiError, DEFAULT_MODEL, type LanguageModel, type ModelMessage } from "@/server/ai/model";

let current: LanguageModel | null = null;

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
