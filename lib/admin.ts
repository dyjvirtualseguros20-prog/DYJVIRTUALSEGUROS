import { siteConfig } from "@/config/site";
import { formatPlainDate } from "@/lib/datetime";
import { formatCOP } from "@/lib/format";
import { QUOTE_FORMS, type FieldDef } from "@/lib/forms/quoteForms";
import { getProduct } from "@/lib/insurance";
import type { QuoteRequestRecord } from "@/types";

/** Campos de form_data que no vienen de los formularios. */
const EXTRA_LABELS: Record<string, string> = {
  observaciones: "Observaciones",
  // Datos que el asesor virtual pide en todos los seguros.
  documentNumber: "Número de identificación",
  city: "Ciudad",
};

/**
 * Convierte form_data en filas "Etiqueta: valor" usando las mismas definiciones
 * de campos de los formularios (lib/forms/quoteForms.ts).
 */
export function describeFormData(
  record: QuoteRequestRecord,
  exclude: string[] = [],
): Array<{ label: string; value: string }> {
  const fields = new Map<string, FieldDef>();
  for (const section of QUOTE_FORMS[record.insuranceType]) {
    for (const field of section.fields) fields.set(field.name, field);
  }

  return Object.entries(record.formData)
    .filter(([name, value]) => !exclude.includes(name) && value !== null && value !== undefined && value !== "")
    .map(([name, value]) => {
      const field = fields.get(name);
      let text = String(value);
      if (field?.kind === "money" && typeof value === "number") text = formatCOP(value);
      if (field?.kind === "date") text = formatPlainDate(text);
      return { label: field?.label ?? EXTRA_LABELS[name] ?? name, value: text };
    });
}

/** Enlace de WhatsApp para escribirle al cliente desde el panel. */
export function clientWhatsappUrl(record: QuoteRequestRecord): string {
  const firstName = record.fullName.split(/\s+/)[0] ?? record.fullName;
  const product = getProduct(record.insuranceType).name.toLowerCase();
  const message = `Hola ${firstName}, somos de ${siteConfig.name}. Recibimos tu solicitud de cotización de ${product} y queremos ayudarte con tu cotización.`;
  return `https://wa.me/${record.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** 3001234567 → 300 123 4567 */
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
}
