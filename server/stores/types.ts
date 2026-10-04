import type {
  InsuranceType,
  QuoteRequestFilters,
  QuoteRequestRecord,
  QuoteRequestUpdate,
  RequestStatus,
} from "@/types";

/** Datos de una solicitud nueva (antes de guardarse). */
export interface NewQuoteRequest {
  reference: string;
  insuranceType: InsuranceType;
  fullName: string;
  identification: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  city: string | null;
  formData: Record<string, unknown>;
}

export interface CreatedQuoteRequest {
  id: string;
  reference: string;
  status: RequestStatus;
  createdAt: string;
}

/** Contrato que cumple cualquier almacenamiento (Supabase o local). */
export interface QuoteRequestStore {
  create(input: NewQuoteRequest): Promise<CreatedQuoteRequest>;
  list(filters: QuoteRequestFilters): Promise<QuoteRequestRecord[]>;
  get(id: string): Promise<QuoteRequestRecord | null>;
  update(id: string, patch: QuoteRequestUpdate): Promise<QuoteRequestRecord | null>;
}

/** Error de referencia duplicada (se reintenta con otra). */
export class DuplicateReferenceError extends Error {}
