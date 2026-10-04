/**
 * SERVICIO DE ASEGURADORAS
 * ─────────────────────────
 * Hoy devuelve aseguradoras FICTICIAS (lib/mock/mockInsurers.ts).
 *
 * 🔌 PUNTO DE CONEXIÓN FUTURO:
 *    Sustituir el bloque MOCK por una llamada a tu API propia, por ejemplo
 *    `GET ${QUOTES_API_URL}/insurers`, hecha desde el servidor.
 */
import { MOCK_INSURERS } from "@/lib/mock/mockInsurers";
import type { InsuranceType, Insurer } from "@/types";
import { DATA_SOURCE } from "./config";

export async function getInsurers(type?: InsuranceType): Promise<Insurer[]> {
  if (DATA_SOURCE === "mock") {
    // ─── MOCK ───
    return type ? MOCK_INSURERS.filter((i) => i.products.includes(type)) : MOCK_INSURERS;
  }
  // ─── API ─── Pendiente: se implementará cuando exista el endpoint en la API propia.
  return [];
}
