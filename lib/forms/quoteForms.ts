import { BUSINESS_INSURANCE, HEALTH_PLANS, HOME_ROLES, HOME_TYPES, VEHICLE_TYPES } from "@/lib/validation/quoteSchemas";
import type { InsuranceType } from "@/types";

/**
 * Definición de los campos de cada formulario de cotización.
 * El componente <QuoteForm> los dibuja automáticamente; las reglas de
 * validación están en lib/validation/quoteSchemas.ts (mismos nombres de campo).
 */
export type FieldKind = "text" | "email" | "tel" | "date" | "number" | "select" | "choice" | "money";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  options?: readonly string[];
  /** Ocupa media fila en pantallas medianas o grandes. */
  half?: boolean;
  uppercase?: boolean;
  maxLength?: number;
  /** Límite de fechas: "past" = hasta hoy, "future" = desde hoy. */
  dateRange?: "past" | "future";
}

export interface FormSection {
  title: string;
  fields: FieldDef[];
}

/* ───────────────── Campos reutilizables ───────────────── */

const fullName: FieldDef = {
  name: "fullName",
  label: "Nombre completo",
  kind: "text",
  placeholder: "Ej.: María Fernanda Gómez",
  autoComplete: "name",
  maxLength: 100,
};

const documentNumber: FieldDef = {
  name: "documentNumber",
  label: "Número de identificación",
  kind: "text",
  placeholder: "Solo números",
  inputMode: "numeric",
  autoComplete: "off",
  maxLength: 15,
  half: true,
};

const phone: FieldDef = {
  name: "phone",
  label: "Teléfono / WhatsApp",
  kind: "tel",
  placeholder: "300 123 4567",
  inputMode: "tel",
  autoComplete: "tel-national",
  maxLength: 16,
  half: true,
};

const email: FieldDef = {
  name: "email",
  label: "Correo electrónico",
  kind: "email",
  placeholder: "nombre@correo.com",
  inputMode: "email",
  autoComplete: "email",
  maxLength: 120,
  half: true,
};

const city: FieldDef = {
  name: "city",
  label: "Ciudad",
  kind: "text",
  placeholder: "Ej.: Bogotá",
  autoComplete: "address-level2",
  maxLength: 60,
  half: true,
};

const birthDate: FieldDef = {
  name: "birthDate",
  label: "Fecha de nacimiento",
  kind: "date",
  dateRange: "past",
  autoComplete: "bday",
  half: true,
};

const contactSection = (extra: FieldDef[] = []): FormSection => ({
  title: "Tus datos de contacto",
  fields: [fullName, ...extra, phone, email],
});

/* ───────────────── Formularios por tipo de seguro ───────────────── */

export const QUOTE_FORMS: Record<InsuranceType, FormSection[]> = {
  vehiculos: [
    contactSection([documentNumber, city]),
    {
      title: "Datos del vehículo",
      fields: [
        {
          name: "plate",
          label: "Placa",
          kind: "text",
          placeholder: "ABC123",
          uppercase: true,
          maxLength: 7,
          autoComplete: "off",
          half: true,
        },
        { name: "vehicleType", label: "Tipo de vehículo", kind: "select", options: VEHICLE_TYPES, half: true },
        { name: "brand", label: "Marca", kind: "text", placeholder: "Ej.: Mazda", maxLength: 40, half: true },
        {
          name: "model",
          label: "Modelo / línea",
          kind: "text",
          placeholder: "Ej.: CX-30 Touring",
          maxLength: 60,
          half: true,
        },
        {
          name: "year",
          label: "Año",
          kind: "number",
          placeholder: "Ej.: 2022",
          inputMode: "numeric",
          maxLength: 4,
          half: true,
        },
      ],
    },
  ],

  vida: [
    contactSection([documentNumber, birthDate, city]),
    {
      title: "Cobertura",
      fields: [
        {
          name: "coverageAmount",
          label: "Valor aproximado de cobertura deseada",
          kind: "money",
          placeholder: "100.000.000",
          inputMode: "numeric",
          hint: "Es solo una referencia: un asesor te ayudará a definir el valor adecuado.",
        },
      ],
    },
  ],

  hogar: [
    contactSection([city]),
    {
      title: "Datos de la vivienda",
      fields: [
        { name: "homeType", label: "Tipo de vivienda", kind: "select", options: HOME_TYPES, half: true },
        { name: "ownership", label: "Eres…", kind: "choice", options: HOME_ROLES, half: true },
        {
          name: "propertyValue",
          label: "Valor aproximado del inmueble",
          kind: "money",
          placeholder: "350.000.000",
          inputMode: "numeric",
        },
      ],
    },
  ],

  salud: [
    contactSection([documentNumber, birthDate, city]),
    {
      title: "Plan",
      fields: [
        { name: "planType", label: "Tipo de plan", kind: "choice", options: HEALTH_PLANS, half: true },
        {
          name: "people",
          label: "Número de personas",
          kind: "number",
          placeholder: "1",
          inputMode: "numeric",
          maxLength: 2,
          half: true,
        },
      ],
    },
  ],

  viajes: [
    contactSection(),
    {
      title: "Datos del viaje",
      fields: [
        { name: "destination", label: "Destino", kind: "text", placeholder: "Ej.: España, Europa", maxLength: 80 },
        { name: "departureDate", label: "Fecha de salida", kind: "date", dateRange: "future", half: true },
        { name: "returnDate", label: "Fecha de regreso", kind: "date", dateRange: "future", half: true },
        {
          name: "travelers",
          label: "Número de viajeros",
          kind: "number",
          placeholder: "1",
          inputMode: "numeric",
          maxLength: 2,
          half: true,
        },
      ],
    },
  ],

  empresas: [
    {
      title: "Datos de la empresa",
      fields: [
        {
          name: "companyName",
          label: "Razón social",
          kind: "text",
          placeholder: "Nombre de la empresa",
          autoComplete: "organization",
          maxLength: 120,
        },
        {
          name: "nit",
          label: "NIT",
          kind: "text",
          placeholder: "900123456-7",
          inputMode: "numeric",
          maxLength: 12,
          half: true,
        },
        city,
        {
          name: "employees",
          label: "Número de empleados",
          kind: "number",
          placeholder: "Ej.: 25",
          inputMode: "numeric",
          maxLength: 6,
          half: true,
        },
        {
          name: "insuranceInterest",
          label: "Seguro de interés",
          kind: "select",
          options: BUSINESS_INSURANCE,
          half: true,
        },
      ],
    },
    {
      title: "Persona de contacto",
      fields: [fullName, phone, email],
    },
  ],
};

/** Valores iniciales vacíos de un formulario. */
export function emptyValues(type: InsuranceType): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = { privacyAccepted: false, dataConsent: false, insurerConsent: false };
  for (const section of QUOTE_FORMS[type]) {
    for (const field of section.fields) values[field.name] = "";
  }
  return values;
}
