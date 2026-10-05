import type { InsuranceType } from "@/types";

/**
 * Catálogo de productos que se muestran en la página.
 * Edita los textos libremente; `id` debe coincidir con types/insurance.ts.
 * Regla: textos generales y verificables. No publicar precios, coberturas exactas ni
 * aseguradoras que no estén confirmadas (dependen de cada aseguradora y de cada plan).
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
  /** SEO: título de la pestaña / Google (sin el nombre de la empresa, se agrega solo). */
  seoTitle: string;
  /** SEO: descripción para Google y al compartir el enlace (≈ 150 caracteres). */
  seoDescription: string;
  /** Sección informativa debajo del formulario. */
  info: {
    title: string;
    intro: string;
    coverages: string[];
    faqs: Array<{ q: string; a: string }>;
  };
}

export const INSURANCE_PRODUCTS: InsuranceProduct[] = [
  {
    id: "vehiculos",
    name: "Seguro de vehículos",
    shortName: "Vehículos",
    quoteTitle: "seguro para tu vehículo",
    description: "Opciones para proteger tu carro o moto frente a daños, pérdida o responsabilidad civil con terceros.",
    requirements: "Ten a mano la placa, la marca, el modelo y el año de tu vehículo.",
    seoTitle: "Cotizar seguro de carro y moto en Bogotá",
    seoDescription:
      "Cotiza en línea el seguro de tu carro o moto. Comparamos opciones de diferentes aseguradoras en Bogotá y toda Colombia, con asesoría por WhatsApp.",
    info: {
      title: "Seguro de vehículos en Bogotá y toda Colombia",
      intro:
        "Un seguro de vehículos te protege frente a los gastos de un accidente, los daños o la pérdida de tu carro o moto, y frente a los daños que puedas causar a otras personas. Te ayudamos a comparar opciones de diferentes aseguradoras para que elijas la que mejor se ajuste a tu vehículo y a tu presupuesto.",
      coverages: [
        "Responsabilidad civil por daños a terceros",
        "Daños a tu vehículo por accidente (pérdida parcial o total)",
        "Hurto del vehículo",
        "Asistencia en carretera, según el plan",
      ],
      faqs: [
        {
          q: "¿El seguro de vehículos reemplaza el SOAT?",
          a: "No. El SOAT es obligatorio y cubre principalmente la atención de las personas lesionadas en un accidente de tránsito. Un seguro voluntario de vehículos protege además tu carro o moto y tu responsabilidad frente a terceros.",
        },
        {
          q: "¿Puedo cotizar el seguro de una moto?",
          a: "Sí. En el formulario puedes elegir motocicleta como tipo de vehículo.",
        },
      ],
    },
  },
  {
    id: "vida",
    name: "Seguro de vida",
    shortName: "Vida",
    quoteTitle: "tu seguro de vida",
    description: "Alternativas de protección financiera para las personas que dependen de ti, según tu situación.",
    requirements: "Solo necesitas tus datos básicos y el valor de cobertura que tienes en mente.",
    seoTitle: "Seguro de vida: cotiza con un asesor",
    seoDescription:
      "Cotiza tu seguro de vida con asesoría personalizada. Comparamos alternativas de diferentes aseguradoras para proteger a tu familia, en Bogotá y toda Colombia.",
    info: {
      title: "Seguro de vida con asesoría personalizada",
      intro:
        "Un seguro de vida entrega un respaldo económico a las personas que tú elijas si llegas a faltar y, según el plan, también puede protegerte en caso de invalidez o de una enfermedad grave. Te ayudamos a definir un valor asegurado acorde a tu situación y a comparar alternativas de diferentes aseguradoras.",
      coverages: [
        "Fallecimiento",
        "Incapacidad total y permanente, según el plan",
        "Enfermedades graves, como cobertura adicional",
        "Beneficiarios que tú eliges",
      ],
      faqs: [
        {
          q: "¿Cómo sé qué valor de cobertura necesito?",
          a: "Depende de tus ingresos, tus deudas y las personas que dependen de ti. Un asesor te ayuda a calcular un valor razonable antes de cotizar.",
        },
        {
          q: "¿Puedo cotizar si no vivo en Bogotá?",
          a: "Sí. La asesoría y la cotización se hacen de forma virtual en toda Colombia.",
        },
      ],
    },
  },
  {
    id: "hogar",
    name: "Seguro de hogar",
    shortName: "Hogar",
    quoteTitle: "el seguro de tu hogar",
    description: "Protección para tu vivienda y lo que hay en ella, seas propietario o arrendatario.",
    requirements: "Ten presente el tipo de vivienda y su valor aproximado.",
    seoTitle: "Cotizar seguro de hogar en Bogotá",
    seoDescription:
      "Cotiza el seguro de tu casa o apartamento, seas propietario o arrendatario. Comparamos opciones de diferentes aseguradoras en Bogotá y toda Colombia.",
    info: {
      title: "Seguro de hogar para propietarios y arrendatarios",
      intro:
        "El seguro de hogar protege tu vivienda y los bienes que hay en ella frente a eventos como un incendio, daños por agua o un hurto. Si vives en arriendo, puedes asegurar tus pertenencias; si eres propietario, también la estructura del inmueble.",
      coverages: [
        "Incendio y eventos de la naturaleza",
        "Daños por agua",
        "Hurto de los bienes de la vivienda",
        "Responsabilidad civil frente a vecinos y terceros",
      ],
      faqs: [
        {
          q: "¿Puedo asegurar mi hogar si vivo en arriendo?",
          a: "Sí. Como arrendatario puedes asegurar tus muebles, electrodomésticos y demás pertenencias.",
        },
        {
          q: "¿Qué valor debo asegurar?",
          a: "El valor aproximado de reconstrucción del inmueble y el de tus bienes. Un asesor te ayuda a estimarlos para que tu seguro no se quede corto.",
        },
      ],
    },
  },
  {
    id: "salud",
    name: "Seguro de salud",
    shortName: "Salud",
    quoteTitle: "tu seguro de salud",
    description: "Planes complementarios para ti o tu familia, con opciones que se ajustan a tus necesidades.",
    requirements: "Indica si buscas un plan individual o familiar y cuántas personas incluir.",
    seoTitle: "Seguro de salud individual y familiar",
    seoDescription:
      "Cotiza un seguro de salud complementario para ti o tu familia. Te asesoramos y comparamos opciones de diferentes aseguradoras en Bogotá y toda Colombia.",
    info: {
      title: "Seguro de salud complementario para ti y tu familia",
      intro:
        "Un seguro de salud complementa la atención de tu EPS y te da acceso a una red de clínicas y especialistas, con más opciones y menos tiempos de espera, según el plan. Puedes elegir un plan individual o familiar.",
      coverages: [
        "Consultas con médicos generales y especialistas",
        "Hospitalización y cirugía",
        "Exámenes de laboratorio y ayudas diagnósticas",
        "Red de clínicas y médicos, según el plan",
      ],
      faqs: [
        {
          q: "¿El seguro de salud reemplaza a la EPS?",
          a: "No. En Colombia la afiliación a una EPS es obligatoria; el seguro de salud es un complemento voluntario.",
        },
        {
          q: "¿Puedo incluir a mi familia?",
          a: "Sí. En el formulario eliges un plan familiar e indicas cuántas personas quieres incluir.",
        },
      ],
    },
  },
  {
    id: "viajes",
    name: "Seguro de viajes",
    shortName: "Viajes",
    quoteTitle: "tu seguro de viaje",
    description: "Asistencia médica y respaldo durante tus viajes nacionales o internacionales.",
    requirements: "Ten listas las fechas de tu viaje, el destino y el número de viajeros.",
    seoTitle: "Seguro de viaje nacional e internacional",
    seoDescription:
      "Cotiza tu seguro de viaje para Colombia o el exterior. Te ayudamos a comparar opciones de diferentes aseguradoras según tu destino, fechas y número de viajeros.",
    info: {
      title: "Seguro de viaje para Colombia y el exterior",
      intro:
        "Un seguro de viaje te respalda si tienes un problema de salud, pierdes tu equipaje o se presenta un imprevisto durante el viaje. Algunos países exigen un seguro de viaje con una cobertura mínima para ingresar; te ayudamos a revisar ese requisito y a comparar opciones.",
      coverages: [
        "Asistencia médica por enfermedad o accidente",
        "Pérdida o demora del equipaje",
        "Cancelación o interrupción del viaje, según el plan",
        "Línea de asistencia de la aseguradora durante el viaje",
      ],
      faqs: [
        {
          q: "¿Cuándo debo cotizar mi seguro de viaje?",
          a: "Apenas tengas las fechas de tu viaje. Así puedes revisar con calma las coberturas y los requisitos de tu destino.",
        },
        {
          q: "¿Sirve para viajes dentro de Colombia?",
          a: "Sí. Puedes cotizar para viajes nacionales e internacionales.",
        },
      ],
    },
  },
  {
    id: "empresas",
    name: "Seguros empresariales",
    shortName: "Empresas",
    quoteTitle: "seguros para tu empresa",
    description: "Soluciones para proteger los activos, la operación y el equipo de tu empresa.",
    requirements: "Necesitaremos la razón social, el NIT y el tipo de seguro que te interesa.",
    seoTitle: "Seguros para empresas en Bogotá y Colombia",
    seoDescription:
      "Cotiza seguros para tu empresa: responsabilidad civil, multirriesgo, flotas, vida grupo y cumplimiento. Comparamos opciones de diferentes aseguradoras.",
    info: {
      title: "Seguros empresariales en Bogotá y toda Colombia",
      intro:
        "Protegemos la operación de tu empresa, sus activos y su equipo de trabajo. Te ayudamos a identificar los riesgos de tu negocio y a comparar alternativas de diferentes aseguradoras, ya sea una pyme o una empresa más grande.",
      coverages: [
        "Responsabilidad civil",
        "Daños materiales y multirriesgo",
        "Flotas de vehículos",
        "Vida grupo y seguros colectivos",
        "Pólizas de cumplimiento",
      ],
      faqs: [
        {
          q: "¿Qué es una póliza de cumplimiento?",
          a: "Es una garantía que suelen exigir los contratos con entidades públicas o privadas para respaldar que el contratista cumplirá sus obligaciones.",
        },
        {
          q: "¿Atienden empresas fuera de Bogotá?",
          a: "Sí. Asesoramos de forma virtual a empresas en toda Colombia y, si es necesario, coordinamos una reunión presencial en Bogotá.",
        },
      ],
    },
  },
];

export function getProduct(id: InsuranceType): InsuranceProduct {
  const product = INSURANCE_PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Producto no encontrado: ${id}`);
  return product;
}
