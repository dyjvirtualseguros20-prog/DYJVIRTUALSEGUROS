import type {
  InsuranceType,
  QuoteRequestFilters,
  QuoteRequestRecord,
  QuoteRequestUpdate,
  RequestSource,
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
  /** Asesor de la visita (sin validar: la base de datos lo valida). */
  advisorId: string | null;
  /** Origen: formulario o asistente virtual. */
  source: RequestSource;
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
