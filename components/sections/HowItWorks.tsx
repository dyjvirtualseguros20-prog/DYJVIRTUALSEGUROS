import { processSteps } from "@/config/content";
import { ButtonLink } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export function HowItWorks() {
  return (
    <section aria-labelledby="proceso-title" className="bg-slate-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="proceso-title"
          eyebrow="Cómo funciona"
          title="Cotizar es así de sencillo"
          description="Cuatro pasos y un asesor contigo en cada uno."
        />
        <ol className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden="true"
            className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-brand-200 via-brand-500/40 to-brand-200 lg:block"
          />
          {processSteps.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 90} className="relative text-center">
              <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-brand-600 shadow-soft ring-1 ring-brand-100">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{step.text}</p>
            </Reveal>
          ))}
        </ol>
        <div className="mt-12 text-center">
          <ButtonLink href="/cotizar" size="lg">
            Empezar mi cotización
            <Icon name="arrowRight" className="size-5" />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
