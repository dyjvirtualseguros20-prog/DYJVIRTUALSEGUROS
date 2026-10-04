import { faqs } from "@/config/content";
import { Container, SectionHeading } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

/** Preguntas frecuentes con <details> nativo: accesible y funciona sin JavaScript. */
export function Faq() {
  return (
    <section id="preguntas" aria-labelledby="faq-title" className="bg-slate-50 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          id="faq-title"
          align="left"
          eyebrow="Preguntas frecuentes"
          title="Resolvemos tus dudas"
          description="¿No encuentras tu pregunta? Escríbenos por WhatsApp y te respondemos."
        />
        <div className="space-y-3">
          {faqs.map((item, i) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white shadow-soft ring-1 ring-slate-100 open:ring-brand-200"
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-semibold text-ink sm:p-6 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-300 group-open:rotate-180">
                  <Icon name="chevronDown" className="size-4" />
                </span>
              </summary>
              <p className="px-5 pb-6 text-[15px] leading-relaxed text-slate-600 sm:px-6">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
