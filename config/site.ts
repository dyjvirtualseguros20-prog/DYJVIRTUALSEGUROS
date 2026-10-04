/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURACIÓN CENTRAL DEL SITIO
 * ─────────────────────────────────────────────────────────────────────────────
 *  Cambia aquí los datos de la empresa y se actualizarán en toda la página.
 *  Los campos vacíos ("") no se muestran: así nunca aparecen datos inventados.
 */

export const siteConfig = {
  /** Nombre comercial que se muestra en el encabezado, pie de página y SEO. */
  name: "D&J Virtual Seguros",
  /** Razón social completa (pie de página y datos estructurados). */
  legalName: "D&J Virtual Seguros Ltda.",
  /** Frase corta para SEO y redes sociales. */
  tagline: "Protegemos lo que más importa",
  description:
    "Agencia de seguros que te ayuda a encontrar opciones de protección para tu vehículo, tu familia, tu hogar, tu salud, tus viajes y tu empresa. Cotiza en línea o habla con un asesor por WhatsApp.",

  /**
   * LOGO
   * Coloca tu archivo en /public (por ejemplo public/logo.png) y escribe la ruta aquí.
   * Si dejas `src: ""` se muestra un marcador temporal claramente identificado.
   * `width` y `height` son las dimensiones reales del archivo (para no deformarlo).
   */
  logo: {
    src: "/logo.png",
    width: 692,
    height: 679,
    alt: "Logo de D&J Virtual Seguros",
  },

  /**
   * WHATSAPP
   * `number`: solo dígitos, con indicativo de país (57 = Colombia), sin "+" ni espacios.
   */
  whatsapp: {
    number: "573118023725",
    display: "+57 311 802 3725",
    defaultMessage: "Hola, quiero recibir información sobre un seguro y conocer las opciones disponibles.",
  },

  /** DATOS DE CONTACTO (déjalos vacíos si aún no los tienes). */
  contact: {
    /** Teléfono principal (se usa el mismo número de WhatsApp). */
    phone: "+57 311 802 3725",
    phoneHref: "+573118023725",
    /** Teléfono adicional, p. ej. "+57 601 000 0000". */
    secondaryPhone: "",
    email: "dyjvirtualseguros20@gmail.com",
    city: "bogota",
    address: "carrera 53 no176 63",
    /** Horario de atención, p. ej. "Lunes a viernes, 8:00 a. m. – 6:00 p. m." */
    schedule: "",
  },

  /**
   * DATOS LEGALES para la Política de Tratamiento de Datos (/politica-de-privacidad).
   * Los campos vacíos aparecen en la página como "PENDIENTE DE COMPLETAR".
   */
  legal: {
    /** NIT con dígito de verificación, p. ej. "900.123.456-7". */
    nit: "900788292",
    /** Dirección física del domicilio principal. */
    address: "carrera 53 no176 63",
    /** Ciudad del domicilio principal. */
    city: "Bogotá",
    /** Correo para consultas y reclamos sobre datos personales. */
    privacyEmail: "cristian.asesor21@gmail.com",
    /** Persona o área responsable de atender las solicitudes de datos personales. */
    privacyContact: "Cristian Muñoz Urrego – Asesor de Seguros",
    /**
     * Tiempo de conservación de solicitudes que no terminan en contratación, p. ej. "2 años".
     * Si se deja vacío, la política usa un texto general (sin plazo fijo).
     */
    retentionPeriod: "",
    /** Proveedor donde se publicará la web (p. ej. "Vercel Inc."). Opcional: si está vacío se usa un texto general. */
    hostingProvider: "",
    /** Fecha de la última actualización de la política (AAAA-MM-DD). */
    privacyPolicyUpdated: "2026-10-04",
  },

  /** REDES SOCIALES: escribe la URL completa. Las vacías no se muestran. */
  social: {
    instagram: "https://www.instagram.com/dyjvirtualseguros20/",
    facebook: "https://www.facebook.com/share/1DnpuDSCKu/",
    tiktok: "",
    linkedin: "",
    youtube: "",
  },

  /**
   * COLORES DE LA MARCA
   * Se inyectan como variables CSS en app/layout.tsx y Tailwind los usa como
   * `brand-*`, `accent-*`, `ink-*`. Cambia solo estos valores.
   */
  colors: {
    brand50: "#EEF3FC",
    brand100: "#DCE6F9",
    brand200: "#B7CAF1",
    brand500: "#2D5BD0",
    brand600: "#1E3F94",
    brand700: "#183377",
    brand800: "#11255A",
    brand900: "#0A1838",
    /** Color de acento (detalles y destacados). Tomado del gris plata del logo. */
    accent: "#8A93A6",
    /** Color de texto principal. */
    ink: "#0F172A",
    whatsapp: "#25D366",
  },

  /**
   * ASEGURADORAS CON LAS QUE TRABAJAS
   * Están desactivadas (`show: false`) para no afirmar alianzas sin confirmar.
   * Cuando lo confirmes, cambia `show` a true y la franja de logos aparecerá en la portada.
   */
  insurerLogos: {
    show: false,
    title: "Trabajamos con aseguradoras reconocidas",
    items: [
      { name: "AXA Colpatria", src: "/aseguradoras/axa-colpatria.png" },
      { name: "Seguros del Estado", src: "/aseguradoras/seguros-del-estado.png" },
      { name: "Seguros Bolívar", src: "/aseguradoras/seguros-bolivar.png" },
      { name: "Allianz", src: "/aseguradoras/allianz.png" },
      { name: "HDI Seguros", src: "/aseguradoras/hdi-seguros.png" },
    ],
  },

  /** Idioma y país (SEO). */
  locale: "es_CO",
  country: "CO",
} as const;

export type SiteConfig = typeof siteConfig;

/** URL pública del sitio, configurable por entorno. */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
