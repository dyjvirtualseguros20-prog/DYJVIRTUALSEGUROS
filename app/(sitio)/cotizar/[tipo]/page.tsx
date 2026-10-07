import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig, siteUrl } from "@/config/site";
import { getProduct, type InsuranceProduct } from "@/lib/insurance";
import { AREA_SERVED, breadcrumbs, jsonLd, ORGANIZATION_ID, pageMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { INSURANCE_TYPES, isInsuranceType } from "@/types";
import { Container } from "@/components/ui/Container";
import { Icon, INSURANCE_ICONS, WhatsAppIcon } from "@/components/ui/Icon";
import { InsuranceSelector } from "@/components/quote/InsuranceSelector";
import { InsuranceInfo } from "@/components/quote/InsuranceInfo";
import { QuoteWizard } from "@/components/quote/QuoteWizard";

type Props = { params: Promise<{ tipo: string }> };

/** URLs amigables generadas en la compilación: /cotizar/vehiculos, /cotizar/vida… */
export function generateStaticParams() {
  return INSURANCE_TYPES.map((tipo) => ({ tipo }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tipo } = await params;
  if (!isInsuranceType(tipo)) return {};
  const product = getProduct(tipo);
  return pageMetadata({ title: product.seoTitle, description: product.seoDescription, path: `/cotizar/${tipo}` });
}

/** Datos estructurados: servicio, ruta de navegación y preguntas frecuentes. */
function StructuredData({ product }: { product: InsuranceProduct }) {
  const path = `/cotizar/${product.id}`;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: product.name,
      serviceType: product.name,
      description: product.info.intro,
      url: new URL(path, siteUrl).toString(),
      provider: { "@type": "InsuranceAgency", "@id": ORGANIZATION_ID, name: siteConfig.name, url: siteUrl },
      areaServed: AREA_SERVED,
    },
    breadcrumbs([
      { name: "Inicio", path: "/" },
      { name: "Cotizar", path: "/cotizar" },
      { name: product.name, path },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: product.info.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />;
}

export default async function CotizarTipoPage({ params }: Props) {
  const { tipo } = await params;
  const contact = await getCurrentContact();
  if (!isInsuranceType(tipo)) notFound();
  const product = getProduct(tipo);

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white pt-24 pb-24 sm:pt-32">
      <StructuredData product={product} />
      <Container className="max-w-4xl">
        <Link
          href="/cotizar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <Icon name="arrowLeft" className="size-4" />
          Cambiar tipo de seguro
        </Link>

        <div className="mt-5">
          <InsuranceSelector variant="tabs" selected={tipo} />
        </div>

        <div className="mt-6 overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-slate-100">
          <header className="flex items-start gap-4 border-b border-slate-100 bg-slate-50/60 p-6 sm:p-8">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Icon name={INSURANCE_ICONS[tipo]} className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Cotiza {product.quoteTitle}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 sm:text-base">{product.requirements}</p>
            </div>
          </header>
          <div className="p-5 sm:p-8">
            <QuoteWizard key={tipo} type={tipo} whatsappNumber={contact.whatsappNumber} />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          ¿Prefieres hacerlo por chat?{" "}
          <a
            href={whatsappUrl(
              `Hola, quiero cotizar ${product.quoteTitle} y conocer las opciones disponibles.`,
              contact.whatsappNumber,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            <WhatsAppIcon className="size-4 text-whatsapp" />
            Cotiza por WhatsApp
          </a>
        </p>

        <InsuranceInfo product={product} />
      </Container>
    </section>
  );
}
