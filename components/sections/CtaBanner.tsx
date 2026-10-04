import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { ButtonLink, ExternalButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";

export async function CtaBanner() {
  const contact = await getCurrentContact();
  return (
    <section aria-labelledby="cta-title" className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-24 size-80 rounded-full border-[40px] border-white/5" />
            <div className="absolute -bottom-32 -left-20 size-96 rounded-full border border-white/10" />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <h2 id="cta-title" className="text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl">
              ¿Listo para encontrar tu seguro?
            </h2>
            <p className="mt-4 text-lg text-brand-100/85">
              Cotiza en línea en pocos minutos o escríbenos y un asesor te guía paso a paso.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/cotizar" variant="light" size="lg">
                Cotizar ahora
                <Icon name="arrowRight" className="size-5" />
              </ButtonLink>
              <ExternalButton href={whatsappUrl(undefined, contact.whatsappNumber)} variant="whatsapp" size="lg">
                <WhatsAppIcon className="size-5" />
                Hablar por WhatsApp
              </ExternalButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
