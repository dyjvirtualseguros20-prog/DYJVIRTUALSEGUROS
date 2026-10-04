import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { INSURANCE_TYPES } from "@/types";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/cotizar`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...INSURANCE_TYPES.map((tipo) => ({
      url: `${siteUrl}/cotizar/${tipo}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${siteUrl}/politica-de-privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
