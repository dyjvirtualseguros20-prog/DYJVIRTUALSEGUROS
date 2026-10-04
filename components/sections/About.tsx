import Image from "next/image";
import { aboutContent } from "@/config/content";
import { siteConfig } from "@/config/site";
import { Container, SectionHeading } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export function About() {
  return (
    <section id="nosotros" aria-labelledby="nosotros-title" className="py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal className="relative order-last lg:order-first">
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-brand-50 to-brand-100"
            />
            <div aria-hidden="true" className="absolute inset-6 rounded-[2rem] border border-dashed border-brand-200" />
            <div className="absolute inset-0 flex items-center justify-center p-16">
              {siteConfig.logo.src ? (
                <div className="rounded-3xl bg-white p-6 shadow-lift">
                  <Image
                    src={siteConfig.logo.src}
                    alt={siteConfig.logo.alt}
                    width={siteConfig.logo.width}
                    height={siteConfig.logo.height}
                    className="h-auto w-full max-w-56 object-contain"
                  />
                </div>
              ) : (
                <Icon name="shield" className="size-32 text-brand-600" />
              )}
            </div>
          </div>
        </Reveal>

        <div>
          <SectionHeading id="nosotros-title" align="left" eyebrow={aboutContent.eyebrow} title={aboutContent.title} />
          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            {aboutContent.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {aboutContent.pillars.map((pillar, i) => (
              <Reveal as="li" key={pillar.title} delay={i * 80} className="rounded-2xl bg-slate-50 p-5">
                <Icon name="check" className="size-5 text-brand-500" strokeWidth={2.5} />
                <h3 className="mt-3 text-sm font-bold text-ink">{pillar.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{pillar.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
