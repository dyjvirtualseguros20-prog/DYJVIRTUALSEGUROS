import type { InsuranceType } from "./insurance";

/**
 * Estados del ciclo de vida de una solicitud de cotización.
 * La clave se guarda en la base de datos (columna `status`); el valor es la etiqueta visible.
 * Si agregas o cambias un estado, actualiza también la restricción CHECK de
 * supabase/migrations/0001_quote_requests.sql.
 */
export const REQUEST_STATUSES = {
  nueva_solicitud: "Nueva solicitud",
  en_revision: "En revisión",
  cotizando: "Cotizando",
  cotizado: "Cotizado",
  contactado: "Contactado",
  vendido: "Vendido",
  cancelado: "Cancelado",
} as const;

export type RequestStatus = keyof typeof REQUEST_STATUSES;

export const REQUEST_STATUS_KEYS = Object.keys(REQUEST_STATUSES) as RequestStatus[];

export function isRequestStatus(value: string): value is RequestStatus {
  return value in REQUEST_STATUSES;
}

/** Datos de contacto comunes a todas las solicitudes. */
export interface ClientContact {
  fullName: string;
  phone: string;
  email: string;
}

/**
 * Solicitud de cotización enviada desde el formulario.
 * `details` contiene los campos específicos de cada tipo de seguro
 * (ver lib/validation/quoteSchemas.ts).
 */
export interface QuoteRequest<TDetails = Record<string, unknown>> {
  insuranceType: InsuranceType;
  contact: ClientContact;
  details: TDetails;
  /** Aceptación de la política de tratamiento de datos personales. */
  dataConsent: true;
}

/** Respuesta al registrar una solicitud. */
export interface QuoteRequestReceipt {
  /** Referencia visible para el cliente, p. ej. "SOL-7K2M9Q". */
  requestId: string;
  status: RequestStatus;
  createdAt: string;
  /** true cuando la respuesta proviene del sistema MOCK. */
  isDemo: boolean;
}

/** Solicitud guardada en la base de datos (tabla quote_requests), tal como la ve el panel /admin. */
export interface QuoteRequestRecord {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  insuranceType: InsuranceType;
  fullName: string;
  /** Cédula o NIT; null en seguros que no la piden (hogar, viajes). */
  identification: string | null;
  /** Teléfono de 10 dígitos tal como lo escribió el cliente (normalizado). */
  phone: string;
  /** Número para WhatsApp con indicativo, solo dígitos (p. ej. 573001234567). */
  whatsapp: string;
  email: string;
  city: string | null;
  status: RequestStatus;
  /** Datos específicos del formulario de cada seguro. */
  formData: Record<string, unknown>;
  advisorNotes: string | null;
  quoteAmount: number | null;
  contactedAt: string | null;
  /**
   * Asesor que originó la visita (enlace /cristian, /...). Lo fija el servidor al
   * registrar la solicitud y no se puede modificar desde /admin. null = sin asesor.
   */
  advisorId: string | null;
}

/** Campos que el asesor puede modificar desde /admin. */
export interface QuoteRequestUpdate {
  status: RequestStatus;
  advisorNotes: string | null;
  quoteAmount: number | null;
  contactedAt: string | null;
}

/** Filtros del listado de /admin. */
export interface QuoteRequestFilters {
  insuranceType?: InsuranceType;
  status?: RequestStatus;
  /** Fecha inicial YYYY-MM-DD (inclusive). */
  from?: string;
  /** Fecha final YYYY-MM-DD (inclusive). */
  to?: string;
  /** Id del asesor, o NO_ADVISOR para las solicitudes sin asesor. */
  advisorId?: string;
}

/** Valor del filtro "Asesor" para las solicitudes que llegaron sin enlace de asesor. */
export const NO_ADVISOR = "sin-asesor";
