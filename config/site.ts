/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURACIÓN CENTRAL DEL SITIO
 * ─────────────────────────────────────────────────────────────────────────────
 *  Cambia aquí los datos de la empresa y se actualizarán en toda la página.
 *  Los campos vacíos ("") no se muestran: así nunca aparecen datos inventados.
 */

export const siteConfig = {
  /**
   * Nombre de la empresa: se usa en toda la web (encabezado, pie de página, títulos, SEO y
   * documentos legales). Es también su nombre legal completo.
   */
  name: "D&J Virtual Seguros Limitada",
  /** Nombre legal completo (documentos legales, autorizaciones y datos estructurados). */
  legalName: "D&J Virtual Seguros Limitada",
  /**
   * Versión corta, SOLO donde el espacio no alcanza (nombre de la app en el celular, subtítulo
   * del chat) y como nombre alternativo para buscadores. No usarla para identificar a la empresa.
   */
  shortName: "D&J Virtual Seguros",
  /** Frase corta para SEO y redes sociales. */
  tagline: "Protegemos lo que más importa",
  description:
    "Agencia de seguros en Bogotá con atención virtual en toda Colombia. Comparamos opciones de diferentes aseguradoras para tu vehículo, vida, hogar, salud, viajes y empresa.",

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
    alt: "Logo de D&J Virtual Seguros Limitada",
  },

  /**
   * NÚMEROS OFICIALES DE LOS ASESORES (llamadas y WhatsApp).
   * Los dos son oficiales y atienden información y cotizaciones; ninguno es principal.
   * Se muestran juntos en Contacto, en el pie de página, en el menú del celular y en los documentos legales.
   * `number`: solo dígitos con indicativo (57); `display`: como se ve en la web.
   */
  advisorLines: [
    { number: "573102892285", display: "+57 310 289 2285" },
    { number: "573118023725", display: "+57 311 802 3725" },
  ],

  /**
   * WHATSAPP del botón flotante y de los enlaces generales (cuando la visita no llega por el
   * enlace de un asesor). `number`: solo dígitos, con indicativo de país, sin "+" ni espacios.
   */
  whatsapp: {
    number: "573118023725",
    display: "+57 311 802 3725",
    defaultMessage: "Hola, quiero recibir información sobre un seguro y conocer las opciones disponibles.",
  },

  /** DATOS DE CONTACTO (déjalos vacíos si aún no los tienes). */
  contact: {
    /** Teléfono de los enlaces generales (el mismo del botón flotante de WhatsApp). */
    phone: "+57 311 802 3725",
    phoneHref: "+573118023725",
    /** Teléfono adicional, p. ej. "+57 601 000 0000". */
    secondaryPhone: "",
    email: "dyjvirtualseguros20@gmail.com",
    city: "Bogotá",
    /**
     * Dirección pública. Vacía a propósito: la dirección de la agencia no es una oficina
     * abierta al público (solo aparece como domicilio en la política de datos).
     */
    address: "",
    /** Zona de atención (se muestra en Contacto y en el pie de página). */
    serviceArea: "Bogotá, con atención virtual en toda Colombia",
    /** Horario de atención comercial: asesoría y cotizaciones. */
    schedule: "Lunes a domingo, 7:00 a. m. – 6:00 p. m.",
    /** Orientación a clientes ante accidentes o situaciones urgentes (no es un servicio de emergencias). */
    urgentSupport: "24/7 para clientes ante accidentes",
  },

  /**
   * DATOS LEGALES para la Política de Tratamiento de Datos (/politica-de-privacidad)
   * y los Términos y Condiciones (/terminos-y-condiciones).
   * Los campos vacíos aparecen en las páginas como "[POR COMPLETAR]": nunca se inventan.
   */
  legal: {
    /** NIT sin dígito de verificación. */
    nit: "900788292",
    /**
     * Dígito de verificación del NIT (aparece en el RUT). Opcional: si está vacío, el NIT se
     * muestra sin él (así lo indicó la empresa).
     */
    nitCheckDigit: "",
    /** Representantes legales (certificado de Cámara de Comercio). */
    legalRepresentatives: ["Jeisson Steven Urrego Pérez", "Deisy Yomaira Urrego Pérez"],
    /** Dirección física del domicilio principal. */
    address: "Carrera 53 # 176-63",
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
    /** Proveedor de alojamiento del sitio. */
    hostingProvider: "Cloudflare, Inc.",
    /** Fecha de la última actualización de la política (AAAA-MM-DD). */
    privacyPolicyUpdated: "2026-10-07",
    /** Versión de la política: se guarda con cada autorización. Súbela si cambias el texto. */
    privacyPolicyVersion: "2.3",
    /** Términos y condiciones: fecha y versión (se guardan con cada solicitud). */
    termsUpdated: "2026-10-07",
    termsVersion: "1.3",
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
