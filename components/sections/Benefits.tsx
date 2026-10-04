import { benefits } from "@/config/content";
import { Container, SectionHeading } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export function Benefits() {
  return (
    <section aria-labelledby="beneficios-title" className="relative overflow-hidden bg-brand-900 py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-48 -left-48 size-[34rem] rounded-full border-[48px] border-white/[0.04]" />
        <div className="absolute -top-32 right-0 size-[28rem] rounded-full bg-brand-600/30 blur-3xl" />
      </div>
      <Container className="relative">
        <SectionHeading
          id="beneficios-title"
          tone="dark"
          eyebrow="Beneficios"
          title="¿Por qué cotizar con nosotros?"
          description="Hacemos que elegir un seguro sea claro, rápido y acompañado."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal
              as="li"
              key={b.title}
              delay={(i % 3) * 80}
              className="rounded-3xl bg-white/[0.04] p-7 ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[0.07]"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-100 ring-1 ring-white/10">
                <Icon name={b.icon} className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-white">{b.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-brand-100/70">{b.text}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
