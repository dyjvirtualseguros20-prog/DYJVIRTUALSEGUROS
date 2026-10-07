import type { Metadata } from "next";
import { siteConfig, siteUrl } from "@/config/site";
import { AREA_SERVED, HOME_TITLE, jsonLd, ORGANIZATION_ID, pageMetadata } from "@/lib/seo";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { About } from "@/components/sections/About";
import { Benefits } from "@/components/sections/Benefits";
import { Contact } from "@/components/sections/Contact";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { InsuranceGrid } from "@/components/sections/InsuranceGrid";
import { InsurerLogos } from "@/components/sections/InsurerLogos";
import { faqs } from "@/config/content";

export const metadata: Metadata = pageMetadata({
  title: HOME_TITLE,
  description: siteConfig.description,
  path: "/",
  absoluteTitle: true,
});

/** Datos estructurados (schema.org) para buscadores. Solo datos reales de config/site.ts. */
function StructuredData() {
  const { contact, social } = siteConfig;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "InsuranceAgency",
      "@id": ORGANIZATION_ID,
      // Marca como nombre principal; la razón social en legalName.
      name: siteConfig.name,
      legalName: siteConfig.legalName,
      alternateName: siteConfig.shortName,
      description: siteConfig.description,
      url: siteUrl,
      logo: siteConfig.logo.src ? new URL(siteConfig.logo.src, siteUrl).toString() : undefined,
      image: new URL("/opengraph-image", siteUrl).toString(),
      telephone: `+${siteConfig.advisorLines[0].number}`,
      // Los dos números oficiales de los asesores (ninguno es principal).
      contactPoint: siteConfig.advisorLines.map((line) => ({
        "@type": "ContactPoint",
        telephone: `+${line.number}`,
        contactType: "customer service",
        areaServed: "CO",
        availableLanguage: "es",
      })),
      email: contact.email || undefined,
      // Sin dirección de calle: la agencia no tiene oficina abierta al público.
      address: {
        "@type": "PostalAddress",
        addressLocality: "Bogotá",
        addressRegion: "Bogotá D.C.",
        addressCountry: "CO",
      },
      areaServed: AREA_SERVED,
      knowsLanguage: "es",
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "07:00",
        closes: "18:00",
      },
      sameAs: Object.values(social).filter(Boolean),
      makesOffer: INSURANCE_PRODUCTS.map((p) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: p.name,
          description: p.description,
          url: new URL(`/cotizar/${p.id}`, siteUrl).toString(),
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteConfig.name,
      url: siteUrl,
      inLanguage: "es-CO",
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />;
}

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Hero />
      <InsurerLogos />
      <InsuranceGrid />
      <HowItWorks />
      <Benefits />
      <About />
      <Faq />
      <CtaBanner />
      <Contact />
    </>
  );
}
