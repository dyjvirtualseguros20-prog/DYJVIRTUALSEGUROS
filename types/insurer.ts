import type { InsuranceType } from "./insurance";

/** Aseguradora que devuelve cotizaciones. */
export interface Insurer {
  id: string;
  name: string;
  /** Ruta del logo (opcional). */
  logo?: string;
  /** Tipos de seguro que cotiza esta aseguradora. */
  products: InsuranceType[];
  /** true cuando es una aseguradora ficticia del sistema MOCK. */
  isDemo: boolean;
}
