import type { InsuranceType } from "@/types";

/**
 * Catálogo de productos que se muestran en la página.
 * Edita los textos libremente; `id` debe coincidir con types/insurance.ts.
 */
export interface InsuranceProduct {
  id: InsuranceType;
  /** Nombre en tarjetas y títulos. */
  name: string;
  /** Nombre corto en el selector del cotizador. */
  shortName: string;
  /** Título del formulario y frase para WhatsApp. */
  quoteTitle: string;
  description: string;
  /** Qué se necesita para cotizar (se muestra en el formulario). */
  requirements: string;
}

export const INSURANCE_PRODUCTS: InsuranceProduct[] = [
  {
    id: "vehiculos",
    name: "Seguro de vehículos",
    shortName: "Vehículos",
    quoteTitle: "seguro para tu vehículo",
    description: "Opciones para proteger tu carro o moto frente a daños, pérdida o responsabilidad civil con terceros.",
    requirements: "Ten a mano la placa, la marca, el modelo y el año de tu vehículo.",
  },
  {
    id: "vida",
    name: "Seguro de vida",
    shortName: "Vida",
    quoteTitle: "tu seguro de vida",
    description: "Alternativas de protección financiera para las personas que dependen de ti, según tu situación.",
    requirements: "Solo necesitas tus datos básicos y el valor de cobertura que tienes en mente.",
  },
  {
    id: "hogar",
    name: "Seguro de hogar",
    shortName: "Hogar",
    quoteTitle: "el seguro de tu hogar",
    description: "Protección para tu vivienda y lo que hay en ella, seas propietario o arrendatario.",
    requirements: "Ten presente el tipo de vivienda y su valor aproximado.",
  },
  {
    id: "salud",
    name: "Seguro de salud",
    shortName: "Salud",
    quoteTitle: "tu seguro de salud",
    description: "Planes complementarios para ti o tu familia, con opciones que se ajustan a tus necesidades.",
    requirements: "Indica si buscas un plan individual o familiar y cuántas personas incluir.",
  },
  {
    id: "viajes",
    name: "Seguro de viajes",
    shortName: "Viajes",
    quoteTitle: "tu seguro de viaje",
    description: "Asistencia médica y respaldo durante tus viajes nacionales o internacionales.",
    requirements: "Ten listas las fechas de tu viaje, el destino y el número de viajeros.",
  },
  {
    id: "empresas",
    name: "Seguros empresariales",
    shortName: "Empresas",
    quoteTitle: "seguros para tu empresa",
    description: "Soluciones para proteger los activos, la operación y el equipo de tu empresa.",
    requirements: "Necesitaremos la razón social, el NIT y el tipo de seguro que te interesa.",
  },
];

export function getProduct(id: InsuranceType): InsuranceProduct {
  const product = INSURANCE_PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Producto no encontrado: ${id}`);
  return product;
}
