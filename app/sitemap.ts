import type { MetadataRoute } from "next";
import { siteConfig, siteUrl } from "@/config/site";
import { CONTENT_UPDATED } from "@/lib/seo";
import { INSURANCE_TYPES } from "@/types";

/** Fechas fijas: solo cambian cuando cambia el contenido (lib/seo.ts → CONTENT_UPDATED). */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(CONTENT_UPDATED);
  return [
    { url: `${siteUrl}/`, lastModified: updated, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/cotizar`, lastModified: updated, changeFrequency: "monthly", priority: 0.9 },
    ...INSURANCE_TYPES.map((tipo) => ({
      url: `${siteUrl}/cotizar/${tipo}`,
      lastModified: updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${siteUrl}/politica-de-privacidad`,
      lastModified: new Date(siteConfig.legal.privacyPolicyUpdated),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
