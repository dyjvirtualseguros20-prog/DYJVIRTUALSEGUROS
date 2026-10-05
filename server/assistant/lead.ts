import "server-only";

/**
 * Estado de la solicitud que el asesor virtual va reuniendo (LeadState).
 * Cada dato se valida con las MISMAS reglas de los formularios (lib/validation/quoteSchemas.ts),
 * así la IA no puede "dar por buenos" datos incorrectos.
 */
import { cleanText, type LeadState, type QuoteDraft } from "@/lib/chat";
import { formatPlainDate } from "@/lib/datetime";
import { formatCOP } from "@/lib/format";
import { QUOTE_FORMS, type FieldDef } from "@/lib/forms/quoteForms";
import { validateQuoteForm } from "@/lib/validation/quoteSchemas";
import { INSURANCE_TYPES, type InsuranceType } from "@/types";

/** Datos personales que sirven para cualquier seguro (se conservan si el cliente cambia de seguro). */
const SHARED_FIELDS = new Set(["fullName", "phone", "email", "city", "documentNumber", "birthDate"]);

export const isInsuranceType = (value: unknown): value is InsuranceType =>
  typeof value === "string" && (INSURANCE_TYPES as readonly string[]).includes(value);

export function fieldsFor(type: InsuranceType): FieldDef[] {
  return QUOTE_FORMS[type].flatMap((section) => section.fields);
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
  /** Campos que aún faltan, en el orden del formulario. */
  missing: FieldDef[];
}

/** Separa los datos válidos, los que tienen error y los que faltan. */
export function evaluateLead(type: InsuranceType, fields: Record<string, string>): LeadEvaluation {
  const defs = fieldsFor(type);
  const candidate = keepKnown(fields, (name) => defs.some((d) => d.name === name));
  const result = validateQuoteForm(type, { ...candidate, dataConsent: true });
  const fieldErrors = result.success ? {} : result.errors;

  const valid: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const [name, value] of Object.entries(candidate)) {
    if (fieldErrors[name]) errors[name] = fieldErrors[name];
    else valid[name] = value;
  }
  return { valid, errors, missing: defs.filter((d) => !(d.name in valid)) };
}

/** Lo que la IA extrajo del último mensaje. */
export interface LeadUpdate {
  insuranceType?: unknown;
  datos?: unknown;
  observaciones?: unknown;
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

  if (!type) {
    // Sin tipo de seguro todavía: se guardan solo los datos personales.
    return {
      lead: { insuranceType: null, fields: keepKnown(merged, (n) => SHARED_FIELDS.has(n)), notes },
      rejected: {},
    };
  }

  const { valid, errors } = evaluateLead(type, merged);
  const rejected: Record<string, string> = {};
  for (const name of Object.keys(incoming)) if (errors[name]) rejected[name] = errors[name];
  return { lead: { insuranceType: type, fields: valid, notes }, rejected };
}

function mergeNotes(previous: string, addition: unknown): string {
  const extra = typeof addition === "string" ? cleanText(addition) : "";
  if (!extra || previous.toLowerCase().includes(extra.toLowerCase())) return previous.slice(0, 500);
  return (previous ? `${previous}. ${extra}` : extra).slice(0, 500);
}

/** Resumen y datos para la tarjeta de confirmación (solo si todo es válido). */
export function buildQuoteDraft(lead: LeadState): QuoteDraft | null {
  if (!lead.insuranceType) return null;
  const type = lead.insuranceType;
  const result = validateQuoteForm(type, { ...lead.fields, dataConsent: true });
  if (!result.success) return null;

  const parsed = result.data as Record<string, unknown>;
  const defs = fieldsFor(type);
  const summary = defs.map((field) => {
    const value = parsed[field.name];
    let text = String(value ?? "");
    if (field.kind === "money" && typeof value === "number") text = formatCOP(value);
    if (field.kind === "date") text = formatPlainDate(text);
    return { label: field.label, value: text };
  });
  const notes = lead.notes || undefined;
  if (notes) summary.push({ label: "Observaciones", value: notes });

  const form = Object.fromEntries(defs.map((d) => [d.name, lead.fields[d.name] ?? ""]));
  return { insuranceType: type, form, notes, summary };
}
