/** Tipos de seguro que ofrece la plataforma. El valor se usa en las URLs (/cotizar/vehiculos). */
export const INSURANCE_TYPES = ["vehiculos", "vida", "hogar", "salud", "viajes", "empresas"] as const;

export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export function isInsuranceType(value: string): value is InsuranceType {
  return (INSURANCE_TYPES as readonly string[]).includes(value);
}
