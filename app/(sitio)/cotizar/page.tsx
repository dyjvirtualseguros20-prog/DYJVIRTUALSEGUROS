import type { Metadata } from "next";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { Container } from "@/components/ui/Container";
import { WhatsAppIcon } from "@/components/ui/Icon";
import { InsuranceSelector } from "@/components/quote/InsuranceSelector";

export const metadata: Metadata = pageMetadata({
  title: "Cotizar seguros en línea en Bogotá y Colombia",
  description:
    "Cotiza en línea tu seguro de carro, vida, hogar, salud, viajes o empresa. Comparamos opciones de diferentes aseguradoras con asesoría personalizada.",
  path: "/cotizar",
});

export default async function CotizarPage() {
  const contact = await getCurrentContact();
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white pt-28 pb-24 sm:pt-36">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbs([
            { name: "Inicio", path: "/" },
            { name: "Cotizar", path: "/cotizar" },
          ]),
        )}
      />
      <Container className="max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-500 uppercase">Cotizador · Paso 1 de 3</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">¿Qué seguro necesitas?</h1>
          <p className="mt-4 text-lg text-slate-600">
            Selecciona una opción y te pediremos solo los datos necesarios para cotizar.
          </p>
        </div>
        <div className="mt-12">
          <InsuranceSelector />
        </div>
        <p className="mt-10 text-center text-sm text-slate-600">
          ¿No sabes cuál elegir?{" "}
          <a
            href={whatsappUrl(undefined, contact.whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            <WhatsAppIcon className="size-4 text-whatsapp" />
            Pregúntale a un asesor
          </a>
        </p>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
          Somos una agencia de seguros en Bogotá con atención virtual en toda Colombia. Comparamos opciones de
          diferentes aseguradoras para que encuentres la alternativa adecuada, con la asesoría de una persona real en
          todo el proceso.
        </p>
      </Container>
    </section>
  );
}
