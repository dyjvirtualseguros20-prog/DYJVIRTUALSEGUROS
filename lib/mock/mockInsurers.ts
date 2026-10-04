/**
 * ⚠️  DATOS MOCK — SOLO PARA DEMOSTRACIÓN ⚠️
 *
 * Aseguradoras FICTICIAS. No representan a ninguna empresa real.
 * Cuando exista la API propia, la lista real vendrá de services/insurers.ts
 * y este archivo dejará de usarse.
 */
import type { Insurer } from "@/types";

export const MOCK_INSURERS: Insurer[] = [
  {
    id: "demo-a",
    name: "Aseguradora A (demo)",
    products: ["vehiculos", "vida", "hogar", "salud", "viajes", "empresas"],
    isDemo: true,
  },
  {
    id: "demo-b",
    name: "Aseguradora B (demo)",
    products: ["vehiculos", "vida", "hogar", "salud", "viajes", "empresas"],
    isDemo: true,
  },
  {
    id: "demo-c",
    name: "Aseguradora C (demo)",
    products: ["vehiculos", "vida", "hogar", "salud", "viajes", "empresas"],
    isDemo: true,
  },
];
