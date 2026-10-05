import "server-only";

/**
 * Mensajes de recolección de datos AGRUPADOS (como un asesor comercial, no un formulario):
 *   "Ya tengo: ✅ … / Para continuar, envíame en un solo mensaje: • … • …"
 * Se arman en el servidor a partir del estado del cliente (LeadState), así nunca se
 * piden datos que ya se conocen ni se pregunta un dato por mensaje.
 */
import type { LeadState } from "@/lib/chat";
import type { FieldDef } from "@/lib/forms/quoteForms";
import { formatPlainDate } from "@/lib/datetime";
import { formatCOP } from "@/lib/format";
import { fieldsFor } from "./lead";

/** Cómo se pide cada dato en la lista. */
const ASK_LABEL: Record<string, string> = {
  fullName: "Nombre completo",
  documentNumber: "Número de identificación (cédula)",
  city: "Ciudad",
  phone: "Celular (WhatsApp)",
  email: "Correo electrónico",
  birthDate: "Fecha de nacimiento",
  plate: "Placa",
  vehicleType: "Tipo de vehículo (automóvil, camioneta, campero, pickup, moto…)",
  brand: "Marca del vehículo",
  model: "Línea o modelo (ej. CX-5)",
  year: "Año del modelo",
  coverageAmount: "Valor aproximado de cobertura que te gustaría (en pesos)",
  homeType: "Tipo de vivienda (casa, apartamento, finca o local)",
  ownership: "Si eres propietario o arrendatario",
  propertyValue: "Valor aproximado del inmueble",
  planType: "Plan individual o familiar",
  people: "Número de personas a asegurar",
  destination: "Destino del viaje",
  departureDate: "Fecha de salida",
  returnDate: "Fecha de regreso",
  travelers: "Número de viajeros",
  companyName: "Razón social de la empresa",
  nit: "NIT",
  employees: "Número de empleados",
  insuranceInterest: "Seguro que te interesa (responsabilidad civil, multirriesgo, flota, vida grupo, cumplimiento)",
};

/** Cómo se muestra cada dato que ya se tiene. */
const KNOWN_LABEL: Record<string, string> = {
  fullName: "👤 Nombre",
  documentNumber: "🪪 Identificación",
  city: "📍 Ciudad",
  phone: "📱 Celular",
  email: "✉️ Correo",
  birthDate: "🎂 Fecha de nacimiento",
  plate: "🔢 Placa",
  vehicleType: "🚙 Tipo",
  year: "📅 Modelo",
};

function formatValue(field: FieldDef, value: string): string {
  if (field.kind === "money") {
    const amount = Number(value.replace(/\D/g, ""));
    return amount ? formatCOP(amount) : value;
  }
  if (field.kind === "date") return formatPlainDate(value);
  return value;
}

/** Líneas "✅ …" con lo que ya se sabe. */
export function knownLines(lead: LeadState): string[] {
  if (!lead.insuranceType) return [];
  const defs = fieldsFor(lead.insuranceType);
  const lines: string[] = [];
  const { brand, model } = lead.fields;
  if (brand || model) lines.push(`🚗 Vehículo: ${[brand, model].filter(Boolean).join(" ")}`);
  for (const field of defs) {
    const value = lead.fields[field.name];
    if (!value || field.name === "brand" || field.name === "model") continue;
    lines.push(`${KNOWN_LABEL[field.name] ?? `✅ ${field.label}`}: ${formatValue(field, value)}`);
  }
  if (lead.coverage) lines.push(`🛡️ Cobertura: ${lead.coverage}`);
  if (lead.useType) lines.push(`🚦 Uso: ${lead.useType}`);
  return lines;
}

/** Viñetas con lo que falta (marca, línea y año van juntos si faltan los tres). */
export function missingBullets(lead: LeadState, missing: FieldDef[]): string[] {
  const names = new Set(missing.map((f) => f.name));
  const bullets: string[] = [];
  const groupVehicle = names.has("brand") && names.has("model") && names.has("year");
  for (const field of missing) {
    if (groupVehicle && (field.name === "model" || field.name === "year")) continue;
    if (groupVehicle && field.name === "brand") {
      bullets.push("Marca, línea y año del vehículo (ej. Mazda CX-5 2023)");
      continue;
    }
    bullets.push(ASK_LABEL[field.name] ?? field.label);
  }
  // Datos útiles para las aseguradoras (opcionales: no bloquean la solicitud).
  if (lead.insuranceType === "vehiculos") {
    if (!lead.coverage) bullets.push("Cobertura que buscas, por ejemplo todo riesgo (opcional)");
    if (!lead.useType) bullets.push("Uso del vehículo: particular o comercial (opcional)");
  }
  return bullets;
}

/**
 * Mensaje completo: confirmación breve + lo que ya se tiene + lo que falta, agrupado.
 * `corrections`: datos que el cliente envió pero no son válidos (se explican primero).
 */
export function groupedRequest(ack: string, lead: LeadState, missing: FieldDef[], corrections: string[] = []): string {
  const parts = [ack];
  if (corrections.length) parts.push(`⚠️ Revisemos:\n${corrections.map((c) => `• ${c}`).join("\n")}`);
  const known = knownLines(lead);
  if (known.length) parts.push(`Ya tengo:\n${known.join("\n")}`);
  const bullets = missingBullets(lead, missing);
  parts.push(
    `${known.length ? "Para continuar, envíame" : "Para solicitar tu cotización, envíame"} en un solo mensaje:\n${bullets
      .map((b) => `• ${b}`)
      .join("\n")}`,
  );
  parts.push("Puedes escribirlos todos juntos, como te quede más fácil, y yo me encargo de organizarlos. 🙂");
  return parts.join("\n\n");
}
