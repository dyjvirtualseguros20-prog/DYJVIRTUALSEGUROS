import type { InsuranceType } from "./insurance";

/** Póliza emitida (para el futuro panel /admin). */
export interface Policy {
  id: string;
  clientId: string;
  quoteId: string;
  insurerId: string;
  insuranceType: InsuranceType;
  policyNumber: string;
  startDate: string;
  endDate: string;
  status: "vigente" | "vencida" | "cancelada";
}
