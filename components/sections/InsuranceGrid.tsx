import Link from "next/link";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { Container, SectionHeading } from "@/components/ui/Container";
import { Icon, INSURANCE_ICONS } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export function InsuranceGrid() {
  return (
    <section id="seguros" aria-labelledby="seguros-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="seguros-title"
          eyebrow="Nuestros seguros"
          title="Elige lo que quieres proteger"
          description="Cuéntanos qué necesitas y comparamos alternativas de diferentes aseguradoras que se ajusten a ti."
        />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INSURANCE_PRODUCTS.map((product, i) => (
            <Reveal as="li" key={product.id} delay={(i % 3) * 80}>
              <article className="group relative flex h-full flex-col rounded-3xl bg-white p-7 shadow-soft ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-brand-200">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                  <Icon name={INSURANCE_ICONS[product.id]} className="size-7" />
                </span>
                <h3 className="mt-6 text-xl font-bold text-ink">{product.name}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate-600">{product.description}</p>
                <Link
                  href={`/cotizar/${product.id}`}
                  className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 after:absolute after:inset-0 after:rounded-3xl"
                  aria-label={`Cotizar ${product.name.toLowerCase()}`}
                >
                  Cotizar
                  <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </article>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
