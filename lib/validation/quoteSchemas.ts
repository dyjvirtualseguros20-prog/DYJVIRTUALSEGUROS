import { z } from "zod";
import type { InsuranceType } from "@/types";

/**
 * Esquemas de validación de los formularios de cotización.
 * Se usan en el navegador (formularios) y en el servidor (app/api/quotes),
 * así las reglas son las mismas en ambos lados.
 */

const required = (label: string) => `Ingresa ${label}.`;

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Texto obligatorio. */
const text = (label: string, max = 80) =>
  z.string().trim().min(1, required(label)).max(max, `Máximo ${max} caracteres.`);

/** Entero dentro de un rango, recibido como texto desde el formulario. */
const integer = (label: string, min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, required(label))
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, message);

const fullName = z
  .string()
  .trim()
  .min(1, required("tu nombre completo"))
  .max(100, "Máximo 100 caracteres.")
  .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede contener letras.")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Escribe tu nombre y apellido.");

const documentNumber = z
  .string()
  .trim()
  .min(1, required("tu número de identificación"))
  .transform(digitsOnly)
  .refine((v) => v.length >= 5 && v.length <= 12, "Debe tener entre 5 y 12 dígitos.");

/** Teléfono colombiano de 10 dígitos (celular o fijo). Acepta +57 al inicio. */
const phone = z
  .string()
  .trim()
  .min(1, required("tu teléfono"))
  .transform((v) => digitsOnly(v).replace(/^57(?=\d{10}$)/, ""))
  .refine((v) => /^\d{10}$/.test(v), "Ingresa un número de 10 dígitos, por ejemplo 3001234567.");

const email = z
  .string()
  .trim()
  .min(1, required("tu correo electrónico"))
  .pipe(z.email("Ingresa un correo válido, por ejemplo nombre@correo.com."))
  .transform((v) => v.toLowerCase());

const city = text("la ciudad", 60);

/** Valor en pesos (el input puede traer separadores de miles). */
const money = (label: string, min: number) =>
  z
    .string()
    .trim()
    .min(1, required(label))
    .transform((v) => Number(digitsOnly(v)))
    .refine((v) => v >= min, `El valor mínimo es $${min.toLocaleString("es-CO")}.`)
    .refine((v) => v <= 100_000_000_000, "El valor es demasiado alto.");

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, required(label))
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Fecha no válida.");

/** Fecha de hoy en formato YYYY-MM-DD (hora local). */
export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function ageFrom(birthISO: string): number {
  const birth = new Date(`${birthISO}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const birthDate = isoDate("tu fecha de nacimiento")
  .refine((v) => v < todayISO(), "La fecha debe ser anterior a hoy.")
  .refine((v) => ageFrom(v) >= 18, "Debes ser mayor de edad para solicitar la cotización.")
  .refine((v) => ageFrom(v) <= 100, "Revisa la fecha de nacimiento.");

const consent = z.literal(true, "Debes aceptar la política de tratamiento de datos para continuar.");

const contactFields = { fullName, phone, email, dataConsent: consent };

/* ───────────────────────────── Opciones de las listas ───────────────────────────── */

export const VEHICLE_TYPES = [
  "Automóvil",
  "Camioneta / SUV",
  "Campero",
  "Pickup",
  "Motocicleta",
  "Vehículo de carga",
  "Otro",
] as const;

export const HOME_TYPES = ["Casa", "Apartamento", "Casa campestre / finca", "Local comercial", "Otro"] as const;

export const HOME_ROLES = ["Propietario", "Arrendatario"] as const;

export const HEALTH_PLANS = ["Individual", "Familiar"] as const;

export const BUSINESS_INSURANCE = [
  "Responsabilidad civil",
  "Daños materiales / multirriesgo",
  "Flota de vehículos",
  "Vida grupo / colectivos",
  "Cumplimiento",
  "Otro / no estoy seguro",
] as const;

const currentYear = new Date().getFullYear();

/* ─────────────────────────────── Esquemas por seguro ─────────────────────────────── */

export const vehiculosSchema = z.object({
  ...contactFields,
  documentNumber,
  plate: z
    .string()
    .trim()
    .min(1, required("la placa"))
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
    .refine((v) => /^[A-Z]{3}\d{2}[A-Z0-9]$/.test(v), "Formato de placa no válido (ej.: ABC123 o ABC12D)."),
  brand: text("la marca", 40),
  model: text("el modelo o línea", 60),
  year: integer("el año", 1970, currentYear + 1, `Ingresa un año entre 1970 y ${currentYear + 1}.`),
  vehicleType: z.enum(VEHICLE_TYPES, "Selecciona el tipo de vehículo."),
  city,
});

export const vidaSchema = z.object({
  ...contactFields,
  documentNumber,
  birthDate,
  city,
  coverageAmount: money("el valor de cobertura deseado", 10_000_000),
});

export const hogarSchema = z.object({
  ...contactFields,
  city,
  homeType: z.enum(HOME_TYPES, "Selecciona el tipo de vivienda."),
  ownership: z.enum(HOME_ROLES, "Indica si eres propietario o arrendatario."),
  propertyValue: money("el valor aproximado del inmueble", 10_000_000),
});

export const saludSchema = z.object({
  ...contactFields,
  documentNumber,
  birthDate,
  city,
  planType: z.enum(HEALTH_PLANS, "Selecciona el tipo de plan."),
  people: integer("el número de personas", 1, 15, "Entre 1 y 15 personas."),
});

const tripDates = z.object({
  departureDate: isoDate("la fecha de salida").refine(
    (v) => v >= todayISO(),
    "La fecha de salida no puede ser una fecha pasada.",
  ),
  returnDate: isoDate("la fecha de regreso"),
});

const viajesFields = {
  ...contactFields,
  destination: text("el destino", 80),
  ...tripDates.shape,
  travelers: integer("el número de viajeros", 1, 20, "Entre 1 y 20 viajeros."),
};

const returnAfterDeparture = {
  error: "La fecha de regreso debe ser igual o posterior a la de salida.",
  path: ["returnDate"],
  // Se valida aunque otros campos tengan errores, siempre que las fechas sean válidas.
  when: (payload: { value: unknown }) => tripDates.safeParse(payload.value).success,
};

export const viajesSchema = z.object(viajesFields).refine((d) => d.returnDate >= d.departureDate, returnAfterDeparture);

export const empresasSchema = z.object({
  ...contactFields,
  companyName: text("la razón social", 120),
  nit: z
    .string()
    .trim()
    .min(1, required("el NIT"))
    .transform((v) => v.replace(/[^\d-]/g, ""))
    .refine((v) => /^\d{6,10}(-\d)?$/.test(v), "Formato de NIT no válido (ej.: 900123456-7)."),
  city,
  employees: integer("el número de empleados", 1, 100_000, "Ingresa un número válido."),
  insuranceInterest: z.enum(BUSINESS_INSURANCE, "Selecciona el seguro de interés."),
});

export const quoteSchemas = {
  vehiculos: vehiculosSchema,
  vida: vidaSchema,
  hogar: hogarSchema,
  salud: saludSchema,
  viajes: viajesSchema,
  empresas: empresasSchema,
} satisfies Record<InsuranceType, z.ZodType>;

export type QuoteSchemas = typeof quoteSchemas;
/** Valores del formulario ya validados y normalizados. */
export type QuoteFormOutput<T extends InsuranceType> = z.output<QuoteSchemas[T]>;
/** Cualquier formulario validado. */
export type AnyQuoteForm = QuoteFormOutput<InsuranceType>;

/** Valida un formulario y devuelve los errores por campo (el primero de cada campo). */
export function validateQuoteForm<T extends InsuranceType>(type: T, values: unknown) {
  const result = quoteSchemas[type].safeParse(values);
  if (result.success) {
    return { success: true as const, data: result.data as QuoteFormOutput<T> };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false as const, errors };
}

/**
 * Cuerpo de POST /api/quotes. El servidor vuelve a validar todo:
 * nunca se confía en la validación del navegador.
 */
export const quoteApiBodySchema = z.discriminatedUnion("insuranceType", [
  z.object({ insuranceType: z.literal("vehiculos"), form: vehiculosSchema }),
  z.object({ insuranceType: z.literal("vida"), form: vidaSchema }),
  z.object({ insuranceType: z.literal("hogar"), form: hogarSchema }),
  z.object({ insuranceType: z.literal("salud"), form: saludSchema }),
  z.object({ insuranceType: z.literal("viajes"), form: viajesSchema }),
  z.object({ insuranceType: z.literal("empresas"), form: empresasSchema }),
]);

/**
 * Campos opcionales del cuerpo de POST /api/quote-requests:
 * - source: "asistente_ia" cuando la solicitud la prepara el asesor virtual (por defecto, formulario).
 * - notes: observaciones del cliente (las recoge el asistente).
 */
export const quoteRequestExtrasSchema = z.object({
  source: z.enum(["formulario", "asistente_ia"]).optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres.")
    .transform((v) => v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim())
    .optional(),
});

/* ───────────────────────── Asesor virtual (reglas propias) ───────────────────────── */

/** Correo opcional: vacío o un correo válido. */
const optionalEmail = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.union([z.literal(""), z.email("Ingresa un correo válido, por ejemplo nombre@correo.com.")]))
  .optional()
  .transform((v) => v || undefined);

/**
 * Reglas de las solicitudes del ASESOR VIRTUAL: las mismas del formulario, pero
 * - el correo es opcional, y
 * - la identificación y la ciudad son obligatorias en todos los seguros.
 * El formulario tradicional NO cambia (usa quoteSchemas).
 */
export const assistantQuoteSchemas = {
  vehiculos: z.object({ ...vehiculosSchema.shape, email: optionalEmail }),
  vida: z.object({ ...vidaSchema.shape, email: optionalEmail }),
  hogar: z.object({ ...hogarSchema.shape, email: optionalEmail, documentNumber }),
  salud: z.object({ ...saludSchema.shape, email: optionalEmail }),
  viajes: z
    .object({ ...viajesFields, email: optionalEmail, documentNumber, city })
    .refine((d) => d.returnDate >= d.departureDate, returnAfterDeparture),
  empresas: z.object({ ...empresasSchema.shape, email: optionalEmail, documentNumber }),
} satisfies Record<InsuranceType, z.ZodType>;

/** Formulario del asistente validado (el correo puede faltar). */
export type AssistantQuoteForm = z.output<(typeof assistantQuoteSchemas)[InsuranceType]>;

export function validateAssistantForm<T extends InsuranceType>(type: T, values: unknown) {
  const result = assistantQuoteSchemas[type].safeParse(values);
  if (result.success) return { success: true as const, data: result.data as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false as const, errors };
}

/** Cuerpo de POST /api/quote-requests cuando source = "asistente_ia". */
export const assistantApiBodySchema = z.discriminatedUnion("insuranceType", [
  z.object({ insuranceType: z.literal("vehiculos"), form: assistantQuoteSchemas.vehiculos }),
  z.object({ insuranceType: z.literal("vida"), form: assistantQuoteSchemas.vida }),
  z.object({ insuranceType: z.literal("hogar"), form: assistantQuoteSchemas.hogar }),
  z.object({ insuranceType: z.literal("salud"), form: assistantQuoteSchemas.salud }),
  z.object({ insuranceType: z.literal("viajes"), form: assistantQuoteSchemas.viajes }),
  z.object({ insuranceType: z.literal("empresas"), form: assistantQuoteSchemas.empresas }),
]);
