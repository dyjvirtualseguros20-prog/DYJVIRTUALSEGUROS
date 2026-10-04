import { siteConfig, siteUrl } from "@/config/site";
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

/** Datos estructurados (schema.org) para buscadores. */
function StructuredData() {
  const { contact, social } = siteConfig;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "InsuranceAgency",
      name: siteConfig.legalName,
      alternateName: siteConfig.name,
      description: siteConfig.description,
      url: siteUrl,
      logo: siteConfig.logo.src ? new URL(siteConfig.logo.src, siteUrl).toString() : undefined,
      telephone: contact.phoneHref,
      email: contact.email || undefined,
      areaServed: "CO",
      address: contact.city
        ? { "@type": "PostalAddress", addressLocality: contact.city, addressCountry: "CO" }
        : undefined,
      sameAs: Object.values(social).filter(Boolean),
      makesOffer: INSURANCE_PRODUCTS.map((p) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: p.name, description: p.description },
      })),
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
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
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
