import "server-only";

/**
 * Estado de la solicitud que el asesor virtual va reuniendo (LeadState).
 * Cada dato se valida con las reglas del asesor virtual (lib/validation/quoteSchemas.ts →
 * assistantQuoteSchemas): las del formulario, con correo opcional y con cédula y ciudad
 * obligatorias en todos los seguros. En vehículos también son obligatorios el uso y la cobertura.
 */
import { cleanText, type LeadState, type QuoteDraft } from "@/lib/chat";
import { formatPlainDate } from "@/lib/datetime";
import { formatCOP } from "@/lib/format";
import { QUOTE_FORMS, type FieldDef } from "@/lib/forms/quoteForms";
import { validateAssistantForm } from "@/lib/validation/quoteSchemas";
import { INSURANCE_TYPES, type InsuranceType } from "@/types";

/** Datos personales que sirven para cualquier seguro (se conservan si el cliente cambia de seguro). */
const SHARED_FIELDS = new Set(["fullName", "phone", "email", "city", "documentNumber", "birthDate"]);

export const isInsuranceType = (value: unknown): value is InsuranceType =>
  typeof value === "string" && (INSURANCE_TYPES as readonly string[]).includes(value);

export function fieldsFor(type: InsuranceType): FieldDef[] {
  return QUOTE_FORMS[type].flatMap((section) => section.fields);
}

const ALL_DEFS = INSURANCE_TYPES.flatMap((t) => fieldsFor(t));
const defOf = (name: string) => ALL_DEFS.find((d) => d.name === name) as FieldDef;
/** Datos personales que se piden primero, en este orden. */
const CONTACT_ORDER = ["fullName", "documentNumber", "city", "phone"];

/** Campos del asesor virtual: obligatorios (contacto primero) y opcionales (correo). */
export function assistantFields(type: InsuranceType): { required: FieldDef[]; optional: FieldDef[] } {
  const form = fieldsFor(type).filter((f) => f.name !== "email");
  const contact = CONTACT_ORDER.map((name) => form.find((f) => f.name === name) ?? defOf(name));
  const rest = form.filter((f) => !CONTACT_ORDER.includes(f.name));
  return { required: [...contact, ...rest], optional: [defOf("email")] };
}

const allFieldsOf = (type: InsuranceType) => {
  const { required, optional } = assistantFields(type);
  return [...required, ...optional];
};

/** Datos que no son campos del formulario pero el asesor necesita (vehículos: uso y cobertura). */
export function missingExtras(lead: LeadState): Array<"useType" | "coverage"> {
  if (lead.insuranceType !== "vehiculos") return [];
  const out: Array<"useType" | "coverage"> = [];
  if (!lead.useType) out.push("useType");
  if (!lead.coverage) out.push("coverage");
  return out;
}

/** ¿Están todos los datos obligatorios para enviar la solicitud? */
export function isLeadComplete(lead: LeadState): boolean {
  return (
    !!lead.insuranceType &&
    evaluateLead(lead.insuranceType, lead.fields).missing.length === 0 &&
    missingExtras(lead).length === 0
  );
}

/** Todos los nombres de campo de todos los formularios. */
export const ALL_FIELD_NAMES = [...new Set(INSURANCE_TYPES.flatMap((t) => fieldsFor(t).map((f) => f.name)))];

function keepKnown(fields: Record<string, unknown>, allowed: (name: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!allowed(name)) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = cleanText(String(value)).slice(0, 200);
    if (text) out[name] = text;
  }
  return out;
}

export interface LeadEvaluation {
  /** Campos válidos. */
  valid: Record<string, string>;
  /** Campos presentes con error → mensaje. */
  errors: Record<string, string>;
  /** Campos OBLIGATORIOS que aún faltan (el correo es opcional y nunca aparece aquí). */
  missing: FieldDef[];
}

/** Separa los datos válidos, los que tienen error y los que faltan. */
export function evaluateLead(type: InsuranceType, fields: Record<string, string>): LeadEvaluation {
  const defs = allFieldsOf(type);
  const candidate = keepKnown(fields, (name) => defs.some((d) => d.name === name));
  const result = validateAssistantForm(type, { ...candidate, dataConsent: true });
  const fieldErrors = result.success ? {} : result.errors;

  const valid: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const [name, value] of Object.entries(candidate)) {
    if (fieldErrors[name]) errors[name] = fieldErrors[name];
    else valid[name] = value;
  }
  return { valid, errors, missing: assistantFields(type).required.filter((d) => !(d.name in valid)) };
}

/** Lo que la IA extrajo del último mensaje. */
export interface LeadUpdate {
  insuranceType?: unknown;
  datos?: unknown;
  observaciones?: unknown;
  /** Cobertura de interés (ya verificada contra lo que escribió el cliente). */
  coverage?: string;
  /** Uso del vehículo (ya verificado). */
  useType?: string;
}

/**
 * Une el estado anterior con lo nuevo. Devuelve el estado (solo con datos válidos) y los
 * datos nuevos que no pasaron la validación, para pedírselos de nuevo al cliente.
 */
export function mergeLead(
  previous: LeadState,
  update: LeadUpdate,
): { lead: LeadState; rejected: Record<string, string> } {
  const type = isInsuranceType(update.insuranceType) ? update.insuranceType : previous.insuranceType;
  const changedType = previous.insuranceType !== null && type !== previous.insuranceType;

  const previousFields = changedType
    ? keepKnown(previous.fields, (name) => SHARED_FIELDS.has(name))
    : keepKnown(previous.fields, (name) => ALL_FIELD_NAMES.includes(name));
  const incoming =
    update.datos && typeof update.datos === "object"
      ? keepKnown(update.datos as Record<string, unknown>, (name) => ALL_FIELD_NAMES.includes(name))
      : {};
  const merged = { ...previousFields, ...incoming };

  const notes = mergeNotes(changedType ? "" : previous.notes, update.observaciones);
  // Un dato nuevo reemplaza al anterior; si no llega nada, se conserva el que había.
  const coverage = cleanText(update.coverage ?? "").slice(0, 120) || (changedType ? "" : previous.coverage);
  const useType = cleanText(update.useType ?? "").slice(0, 120) || (changedType ? "" : previous.useType);
  const extras = { coverage, useType, notes };

  if (!type) {
    // Sin tipo de seguro todavía: se guardan solo los datos personales.
    return {
      lead: { insuranceType: null, fields: keepKnown(merged, (n) => SHARED_FIELDS.has(n)), ...extras },
      rejected: {},
    };
  }

  let { valid, errors } = evaluateLead(type, merged);
  const rejected: Record<string, string> = {};
  for (const name of Object.keys(incoming)) if (errors[name]) rejected[name] = errors[name];
  // Si el dato nuevo no es válido pero había uno válido antes, se conserva el anterior.
  const restore = Object.keys(rejected).filter((name) => previousFields[name]);
  if (restore.length) {
    ({ valid, errors } = evaluateLead(type, {
      ...merged,
      ...Object.fromEntries(restore.map((n) => [n, previousFields[n]])),
    }));
  }
  return { lead: { insuranceType: type, fields: valid, ...extras }, rejected };
}

/** Observaciones que se guardan con la solicitud: cobertura, uso y otros detalles. */
export function leadNotes(lead: LeadState): string | undefined {
  const parts = [
    lead.coverage && `Cobertura de interés: ${lead.coverage}`,
    lead.useType && `Uso: ${lead.useType}`,
    lead.notes,
  ].filter(Boolean);
  return parts.length ? parts.join(". ").slice(0, 500) : undefined;
}

function mergeNotes(previous: string, addition: unknown): string {
  const extra = typeof addition === "string" ? cleanText(addition) : "";
  if (!extra || previous.toLowerCase().includes(extra.toLowerCase())) return previous.slice(0, 500);
  return (previous ? `${previous}. ${extra}` : extra).slice(0, 500);
}

/** Cómo se muestra cada dato en la tarjeta de confirmación. */
const CARD_LABEL: Record<string, string> = {
  fullName: "👤 Nombre",
  documentNumber: "🪪 Cédula",
  city: "📍 Ciudad",
  phone: "📱 Celular",
  email: "✉️ Correo",
  birthDate: "🎂 Fecha de nacimiento",
  year: "📅 Año",
  plate: "🔢 Placa",
  vehicleType: "🚙 Tipo",
};

/** Resumen y datos para la tarjeta de confirmación (solo si todo lo obligatorio es válido). */
export function buildQuoteDraft(lead: LeadState): QuoteDraft | null {
  if (!lead.insuranceType || !isLeadComplete(lead)) return null;
  const type = lead.insuranceType;
  const result = validateAssistantForm(type, { ...lead.fields, dataConsent: true });
  if (!result.success) return null;

  const parsed = result.data;
  const defs = allFieldsOf(type);
  const show = (field: FieldDef) => {
    const value = parsed[field.name];
    let text = String(value ?? "");
    if (field.kind === "money" && typeof value === "number") text = formatCOP(value);
    if (field.kind === "date") text = formatPlainDate(text);
    return { label: CARD_LABEL[field.name] ?? `✅ ${field.label}`, value: text };
  };

  // Orden: datos personales, vehículo (marca y línea), año, placa, tipo y el resto del formulario.
  const personal = ["fullName", "documentNumber", "city", "phone", "email"];
  const vehicleOrder = ["year", "plate", "vehicleType"];
  const summary: QuoteDraft["summary"] = [];
  for (const name of personal) {
    const field = defs.find((d) => d.name === name);
    // El correo solo aparece si el cliente lo dio.
    if (field && (name !== "email" || parsed.email)) summary.push(show(field));
  }
  if (type === "vehiculos") summary.push({ label: "🚗 Vehículo", value: `${parsed.brand} ${parsed.model}` });
  const rest = defs
    .filter((d) => !personal.includes(d.name) && d.name !== "brand" && d.name !== "model")
    .sort((x, y) => (vehicleOrder.indexOf(x.name) + 1 || 99) - (vehicleOrder.indexOf(y.name) + 1 || 99));
  for (const field of rest) summary.push(show(field));
  if (lead.coverage) summary.push({ label: "🛡️ Cobertura", value: lead.coverage });
  if (lead.useType) summary.push({ label: "🏷️ Uso", value: lead.useType });
  if (lead.notes) summary.push({ label: "📝 Observaciones", value: lead.notes });

  const form = Object.fromEntries(defs.map((d) => [d.name, lead.fields[d.name] ?? ""]));
  return { insuranceType: type, form, notes: leadNotes(lead), summary };
}
