import "server-only";

/**
 * "Anclaje" de los datos que extrae la IA: solo se aceptan si el cliente realmente los
 * escribió en la conversación. Evita que el modelo complete datos por su cuenta
 * (por ejemplo, suponer "Automóvil" o inventar un año).
 * Además, extrae de forma determinista datos inconfundibles (correo, celular, placa)
 * por si el modelo los pasa por alto.
 */
import { QUOTE_FORMS, type FieldDef } from "@/lib/forms/quoteForms";
import { INSURANCE_TYPES, type InsuranceType } from "@/types";

/** minúsculas, sin tildes. */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Solo letras y números, sin espacios ni signos. */
const compact = (s: string) => fold(s).replace(/[^a-z0-9@.]/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** Palabras con las que un cliente suele referirse a cada opción de las listas. */
const OPTION_WORDS: Record<string, string[]> = {
  Automóvil: ["automovil", "auto ", "carro", "sedan", "hatchback"],
  "Camioneta / SUV": ["camioneta", "suv"],
  Campero: ["campero", "jeep", "4x4"],
  Pickup: ["pickup", "pick up", "pick-up", "platon"],
  Motocicleta: ["moto"],
  "Vehículo de carga": ["carga", "camion", "furgon", "volqueta"],
  Otro: ["otro", "otra"],
  Casa: ["casa"],
  Apartamento: ["apartamento", "apto", "aparta"],
  "Casa campestre / finca": ["finca", "campestre", "casa de campo"],
  "Local comercial": ["local"],
  Propietario: ["propietario", "propia", "mia", "dueno", "dueña"],
  Arrendatario: ["arrendatario", "arriendo", "arrendad", "alquil"],
  Individual: ["individual", "solo para mi", "para mi solo", "solo yo"],
  Familiar: ["familia", "familiar", "esposa", "esposo", "hijos", "hijo", "hija"],
  "Responsabilidad civil": ["responsabilidad"],
  "Daños materiales / multirriesgo": ["multirriesgo", "danos materiales", "incendio", "bienes"],
  "Flota de vehículos": ["flota", "vehiculos de la empresa"],
  "Vida grupo / colectivos": ["vida grupo", "colectiv", "empleados"],
  Cumplimiento: ["cumplimiento", "licitacion", "contrato"],
  "Otro / no estoy seguro": ["no estoy seguro", "no se", "otro"],
};

function fieldDef(name: string): FieldDef | undefined {
  for (const type of INSURANCE_TYPES) {
    for (const section of QUOTE_FORMS[type]) {
      const found = section.fields.find((f) => f.name === name);
      if (found) return found;
    }
  }
  return undefined;
}

/** ¿El valor aparece (de alguna forma) en lo que escribió el cliente? */
function isGrounded(name: string, value: string, userText: string): boolean {
  const def = fieldDef(name);
  const folded = fold(userText);
  if (def?.options) {
    const words = OPTION_WORDS[value] ?? [fold(value)];
    return words.some((w) => folded.includes(w)) || folded.includes(fold(value));
  }
  const textDigits = digits(userText);
  switch (def?.kind) {
    case "date": {
      // 1990-05-17: basta con que el cliente haya escrito el año y el día.
      const [y, , d] = value.split("-");
      return !!y && textDigits.includes(y) && (!d || textDigits.includes(String(Number(d))));
    }
    case "money": {
      // 150000000 ← "150 millones", "150.000.000": cifras significativas.
      const significant = digits(value).replace(/0+$/, "");
      return significant.length > 0 && textDigits.includes(significant);
    }
    case "number":
    case "tel":
      return digits(value).length > 0 && textDigits.includes(digits(value));
    default:
      if (/^\d[\d\s.-]*$/.test(value)) return textDigits.includes(digits(value));
      return compact(userText).includes(compact(value));
  }
}

/** Deja solo los datos que el cliente realmente escribió. */
export function groundedData(datos: Record<string, unknown>, userText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(datos)) {
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const value = String(raw).trim();
    if (value && isGrounded(name, value, userText)) out[name] = value;
  }
  return out;
}

/** Datos inconfundibles del último mensaje (por si el modelo no los extrajo). */
export function obviousData(lastMessage: string, type: InsuranceType | null): Record<string, string> {
  const out: Record<string, string> = {};
  const email = lastMessage.match(/[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i)?.[0];
  if (email) out.email = email.replace(/[.,;]+$/, "");
  const phone = lastMessage.replace(/(\d)[\s.-](?=\d)/g, "$1").match(/(?:\+?57)?(3\d{9})(?!\d)/)?.[1];
  if (phone) out.phone = phone;
  if (type === "vehiculos") {
    const plate = lastMessage.toUpperCase().match(/\b([A-Z]{3})[\s-]?(\d{2}[A-Z0-9])\b/);
    if (plate) out.plate = `${plate[1]}${plate[2]}`;
  }
  return out;
}

/** Palabras inconfundibles para elegir una opción de lista sin preguntar (sin "carro" ni "auto": son ambiguas). */
const CLEAR_OPTION_WORDS: Record<string, string[]> = {
  "Camioneta / SUV": ["camioneta", "suv"],
  Campero: ["campero"],
  Pickup: ["pickup", "pick up", "pick-up"],
  Motocicleta: ["moto", "motos", "motocicleta"],
  "Vehículo de carga": ["camion", "furgon", "volqueta"],
  Apartamento: ["apartamento", "apto"],
  "Casa campestre / finca": ["finca", "campestre"],
  "Local comercial": ["local comercial"],
  Propietario: ["propietario", "soy el dueno", "soy la duena", "es propia"],
  Arrendatario: ["arrendatario", "arriendo", "vivo arrendado", "alquilo"],
  Individual: ["individual", "solo para mi"],
  Familiar: ["familiar", "para mi familia", "toda la familia"],
  "Responsabilidad civil": ["responsabilidad civil"],
  "Flota de vehículos": ["flota"],
  Cumplimiento: ["poliza de cumplimiento", "cumplimiento"],
};

/** Opciones de lista que el cliente nombró sin lugar a dudas (una sola coincidencia por campo). */
export function obviousOptions(userText: string, type: InsuranceType | null, known: Record<string, string>) {
  const out: Record<string, string> = {};
  if (!type) return out;
  const text = fold(userText);
  for (const section of QUOTE_FORMS[type]) {
    for (const field of section.fields) {
      if (!field.options || known[field.name]) continue;
      const matches = field.options.filter((option) =>
        (CLEAR_OPTION_WORDS[option] ?? []).some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(text)),
      );
      if (matches.length === 1) out[field.name] = matches[0];
    }
  }
  return out;
}
