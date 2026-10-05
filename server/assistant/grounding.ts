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
    const value = decodeEscapes(String(raw)).trim();
    if (value && isGrounded(name, value, userText)) out[name] = originalSpelling(name, value, userText);
  }
  return out;
}

/** "Bogotá" → "Bogotá" (algunos modelos devuelven las tildes escapadas). */
const decodeEscapes = (s: string) =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/**
 * Para textos (nombre, ciudad, marca…) se usa la escritura exacta del cliente: si el modelo
 * devolvió "Bogot" o "bogota", se guarda "Bogotá" tal como lo escribió.
 */
function originalSpelling(name: string, value: string, userText: string): string {
  const def = fieldDef(name);
  if (def?.options || (def?.kind && def.kind !== "text")) return value;
  if (/^[\d\s.+-]+$/.test(value)) return value;
  const target = fold(value).replace(/[^a-z0-9]/g, "");
  const tokens = userText.split(/[\s,;:]+/).filter(Boolean);
  const size = value.split(/\s+/).length;
  for (let i = 0; i + size <= tokens.length; i++) {
    const span = tokens
      .slice(i, i + size)
      .join(" ")
      .replace(/[.!?]+$/, "");
    const folded = fold(span).replace(/[^a-z0-9]/g, "");
    if (folded === target || (folded.startsWith(target) && folded.length - target.length <= 2)) return span;
  }
  return value;
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

/** Cobertura y uso del vehículo mencionados por el cliente (para no volver a preguntarlos). */
export function obviousExtras(userText: string): { coverage?: string; useType?: string } {
  const text = fold(userText);
  const out: { coverage?: string; useType?: string } = {};
  if (/todo\s*riesgo/.test(text)) out.coverage = "Todo riesgo";
  else if (/responsabilidad civil|\brc\b/.test(text)) out.coverage = "Responsabilidad civil";
  if (/particular|uso personal|uso familiar/.test(text)) out.useType = "Particular";
  else if (/comercial|taxi|plataforma|uber|servicio publico|para trabajar|uso de trabajo/.test(text))
    out.useType = "Comercial";
  return out;
}

/**
 * Cédula y año escritos sin contexto ("…, 1000572982, Bogotá, …, 2023"): solo si hay una
 * única cifra posible y el campo todavía falta.
 */
export function obviousNumbers(lastMessage: string, missing: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  // Valores en pesos ("200 millones", "$300.000.000") no son cédulas.
  if (/mill[oó]n|\$|pesos|valor|cobertura de/i.test(lastMessage)) return out;
  const numbers = (lastMessage.match(/\d[\d.]*\d|\d/g) ?? []).map((n) => n.replace(/\./g, ""));

  if (missing.has("documentNumber")) {
    // 5 a 12 cifras, que no sea un celular (10 cifras empezando por 3) ni un año.
    const ids = numbers.filter((n) => n.length >= 5 && n.length <= 12 && !/^3\d{9}$/.test(n) && !/^57?3\d{9}$/.test(n));
    if (ids.length === 1) out.documentNumber = ids[0];
  }
  if (missing.has("year")) {
    const max = new Date().getFullYear() + 1;
    const years = numbers.filter((n) => /^(19[7-9]\d|20\d\d)$/.test(n) && Number(n) <= max);
    if (years.length === 1) out.year = years[0];
  }
  return out;
}

/** Palabras que no aparecen en un nombre propio ("Es una camioneta de uso particular" no es un nombre). */
const NOT_NAME =
  /^(es|una|un|mi|mis|tengo|quiero|necesito|uso|para|con|placa|correo|carro|vehiculo|camioneta|moto|seguro|todo|riesgo|particular|comercial|hola|vivo|en|que|soy|cedula|celular|numero|ciudad|modelo|marca|asegurar|cotizar|gracias)$/;

/** ¿Parece un nombre completo? (2 a 6 palabras, solo letras, sin palabras comunes de una frase). */
export function looksLikeName(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (
    /^[\p{L}' .-]+$/u.test(value.trim()) &&
    words.length >= 2 &&
    words.length <= 6 &&
    value.trim().length <= 80 &&
    !words.some((w) => NOT_NAME.test(fold(w)))
  );
}

/** Nombre completo: "me llamo …", "mi nombre es …", "soy …" o el primer elemento de una lista "Nombre Apellido, 1020…". */
export function obviousName(lastMessage: string): string | undefined {
  const intro = lastMessage.match(
    /(?:me llamo|mi nombre es|mi nombre completo es|soy)\s+([\p{L}' .-]+?)(?=\s*[,;.\n]|\s+(?:y|con|de|vivo|mi|c[eé]dula|cel|tel|correo|n[uú]mero)\b|$)/iu,
  );
  if (intro && looksLikeName(intro[1])) return intro[1].trim();

  // Lista: el primer elemento es el nombre si lo que sigue trae datos (números o correo).
  const [first, ...rest] = lastMessage.split(/[,;\n]/);
  if (rest.length && /[\d@]/.test(rest.join(" ")) && first && looksLikeName(first)) return first.trim();
  return undefined;
}

/** Ciudades frecuentes, con su escritura correcta (para reconocerlas aunque el modelo no las extraiga). */
const CITIES = [
  "Bogotá",
  "Medellín",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Cúcuta",
  "Ibagué",
  "Santa Marta",
  "Villavicencio",
  "Pasto",
  "Montería",
  "Neiva",
  "Armenia",
  "Popayán",
  "Valledupar",
  "Sincelejo",
  "Tunja",
  "Riohacha",
  "Quibdó",
  "Florencia",
  "Yopal",
  "Soacha",
  "Chía",
  "Zipaquirá",
  "Facatativá",
  "Mosquera",
  "Funza",
  "Madrid",
  "Cajicá",
  "Fusagasugá",
  "Girardot",
  "Bello",
  "Envigado",
  "Itagüí",
  "Sabaneta",
  "Rionegro",
  "Soledad",
  "Palmira",
  "Buenaventura",
  "Tuluá",
  "Jamundí",
  "Floridablanca",
  "Girón",
  "Piedecuesta",
  "Dosquebradas",
  "Sogamoso",
  "Duitama",
  "Apartadó",
  "Turbo",
  "Barrancabermeja",
  "San Andrés",
];

/** Ciudad: "vivo en …", "ciudad: …" o una ciudad conocida mencionada en el mensaje. */
export function obviousCity(lastMessage: string): string | undefined {
  const text = fold(lastMessage);
  const known = CITIES.filter((c) => new RegExp(`(^|[^a-z])${fold(c)}([^a-z]|$)`).test(text));
  if (known.length === 1) return known[0];
  const said = lastMessage.match(
    /(?:vivo en|ciudad(?: es)?:?|resido en|estoy en)\s+([\p{L}][\p{L} .'-]{1,40}?)(?=\s*[,;.\n]|\s+y\b|$)/iu,
  );
  return said?.[1]?.trim();
}

/** Quita comillas y signos sueltos al inicio o al final ("Particular”," → "Particular"). */
export const trimPunctuation = (s: string) => s.replace(/^[\s"“”'«».,;:]+|[\s"“”'«».,;:]+$/g, "");

/**
 * Tipo de vehículo según la línea que escribió el cliente (dato conocido de cada modelo,
 * no una suposición): "Mazda CX-5" → Camioneta / SUV, "Toyota Hilux" → Pickup.
 * Si la línea no está en la lista, el asistente pregunta el tipo.
 */
const VEHICLE_LINES: Record<string, string[]> = {
  "Camioneta / SUV": [
    "cx3",
    "cx30",
    "cx5",
    "cx50",
    "cx9",
    "cx90",
    "tucson",
    "santafe",
    "creta",
    "kona",
    "venue",
    "sportage",
    "sorento",
    "seltos",
    "sonet",
    "duster",
    "captur",
    "koleos",
    "rav4",
    "fortuner",
    "prado",
    "landcruiser",
    "corollacross",
    "xtrail",
    "qashqai",
    "kicks",
    "tracker",
    "captiva",
    "equinox",
    "trailblazer",
    "tiguan",
    "tcross",
    "taos",
    "touareg",
    "escape",
    "explorer",
    "broncosport",
    "territory",
    "ecosport",
    "vitara",
    "grandvitara",
    "scross",
    "jimny",
    "asx",
    "outlander",
    "eclipsecross",
    "montero",
    "forester",
    "xv",
    "crosstrek",
    "outback",
    "compass",
    "renegade",
    "cherokee",
    "grandcherokee",
    "wrangler",
    "hrv",
    "crv",
    "wrv",
    "pilot",
    "x1",
    "x3",
    "x5",
    "q3",
    "q5",
    "q7",
    "glc",
    "gla",
    "gle",
    "tiggo",
    "jolion",
    "h6",
    "t5evo",
    "kx3",
  ],
  Pickup: [
    "hilux",
    "ranger",
    "frontier",
    "navara",
    "dmax",
    "amarok",
    "l200",
    "colorado",
    "oroch",
    "alaskan",
    "tacoma",
    "bt50",
    "tundra",
    "f150",
    "ram",
    "saveiro",
    "strada",
    "montana",
    "maverick",
    "poer",
    "t60",
  ],
  Automóvil: [
    "mazda2",
    "mazda3",
    "mazda6",
    "spark",
    "sail",
    "onix",
    "joy",
    "aveo",
    "cruze",
    "logan",
    "sandero",
    "stepway",
    "kwid",
    "picanto",
    "rio",
    "cerato",
    "k3",
    "accent",
    "i10",
    "i20",
    "elantra",
    "yaris",
    "corolla",
    "march",
    "versa",
    "sentra",
    "swift",
    "dzire",
    "baleno",
    "gol",
    "polo",
    "virtus",
    "jetta",
    "golf",
    "fiesta",
    "focus",
    "mobi",
    "argo",
    "cronos",
    "208",
    "2008",
    "3008",
    "clio",
    "city",
    "civic",
    "accord",
    "serie3",
    "a3",
    "a4",
    "clasec",
    "clasea",
  ],
};

export function vehicleTypeFromLine(userText: string): string | undefined {
  const compactText = fold(userText).replace(/[^a-z0-9]/g, " ");
  const tokens = compactText.split(/\s+/).filter(Boolean);
  // Une pares de palabras ("cx 5" → "cx5", "santa fe" → "santafe") para reconocer las líneas.
  const candidates = new Set([...tokens, ...tokens.slice(0, -1).map((t, i) => t + tokens[i + 1])]);
  const matches = Object.entries(VEHICLE_LINES)
    .filter(([, lines]) => lines.some((line) => candidates.has(line)))
    .map(([type]) => type);
  return matches.length === 1 ? matches[0] : undefined;
}

/** ¿El texto menciona datos de salud? (dato sensible: no se guarda en la solicitud). */
const HEALTH =
  /(diabet|cancer|\bvih\b|\bsida\b|enfermedad|diagnostic|tratamiento medico|medicament|embaraz|discapacidad|hipertension|cirugia|psiquiatr|depresion|epilep|hospitaliz|condicion de salud|preexisten|transplant|trasplant|dialisis|quimioterap)/;
export const containsHealthData = (text: string) => HEALTH.test(fold(text));

/**
 * Afirmaciones que el asistente nunca puede hacer: aprobación o emisión de pólizas, garantías,
 * "la mejor aseguradora" o precios que el cliente no escribió.
 */
const FORBIDDEN_CLAIMS =
  /(poliza\s+(ya\s+)?(esta\s+|ha\s+sido\s+|quedo\s+|fue\s+)?(aprobada|emitida|activa|expedida))|(ya\s+(estas|quedaste|quedas)\s+asegurad)|(te\s+garantiz)|(garantizad[oa])|(la\s+mejor\s+aseguradora)|(aseguradora\s+mas\s+barata)/;

export function unsafeClaim(reply: string, userText: string): boolean {
  if (FORBIDDEN_CLAIMS.test(fold(reply))) return true;
  // Precios: cualquier cifra en pesos debe venir de lo que escribió el cliente.
  const prices = reply.match(/\$\s?\d[\d.,]*|\d[\d.,]*\s*(pesos|cop|millones)/gi) ?? [];
  const userDigits = userText.replace(/\D/g, "");
  return prices.some((p) => {
    const d = p.replace(/\D/g, "").replace(/0+$/, "");
    return d.length > 0 && !userDigits.includes(d);
  });
}
