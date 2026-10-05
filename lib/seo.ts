import type { Metadata } from "next";
import { siteConfig, siteUrl } from "@/config/site";

/** Fecha de la última revisión del contenido (para el sitemap). Actualízala al cambiar textos. */
export const CONTENT_UPDATED = "2026-10-05";

/** Título de la portada (y título por defecto). */
export const HOME_TITLE = `Agencia de seguros en Bogotá | Cotiza en línea | ${siteConfig.name}`;

/** Identificador de la agencia en los datos estructurados (lo usan las páginas de servicio). */
export const ORGANIZATION_ID = `${siteUrl}/#organization`;

/**
 * Metadatos de una página: título, descripción, URL canónica y vista previa al
 * compartir (Open Graph / X), con la imagen de app/opengraph-image.tsx.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** true: el título se usa tal cual, sin agregar " | D&J Virtual Seguros". */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;
  // Al definir openGraph en la página, Next.js ya no hereda la imagen de app/opengraph-image.tsx.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: `${siteConfig.name} — ${siteConfig.tagline}` };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      url: path,
      title: fullTitle,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image] },
  };
}

/** Inserta datos estructurados (schema.org) de forma segura. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/** Ruta de navegación (Inicio › Cotizar › …) para Google. */
export function breadcrumbs(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).toString(),
    })),
  };
}

/** Zona de atención: Bogotá (presencial con cita) y toda Colombia (virtual). */
export const AREA_SERVED = [
  { "@type": "City", name: "Bogotá" },
  { "@type": "Country", name: "Colombia" },
];
