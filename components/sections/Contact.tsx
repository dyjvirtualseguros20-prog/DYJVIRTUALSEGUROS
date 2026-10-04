import { siteConfig } from "@/config/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { ExternalButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";
import { AdvisorAvatar } from "@/components/ui/AdvisorAvatar";
import { Icon, WhatsAppIcon, type IconName } from "@/components/ui/Icon";

export async function Contact() {
  const { contact } = siteConfig;
  // WhatsApp y teléfono: los del asesor del enlace (/cristian, ...) o los de la empresa.
  const current = await getCurrentContact();

  // Solo se muestran los datos que estén configurados en config/site.ts.
  const items: Array<{ icon: IconName; label: string; value: string; href?: string }> = [
    { icon: "phone", label: "Teléfono", value: current.phoneDisplay, href: `tel:${current.phoneHref}` },
    ...(contact.secondaryPhone
      ? [{ icon: "phone" as const, label: "Teléfono adicional", value: contact.secondaryPhone }]
      : []),
    ...(contact.email
      ? [{ icon: "mail" as const, label: "Correo", value: contact.email, href: `mailto:${contact.email}` }]
      : []),
    ...(contact.city || contact.address
      ? [
          {
            icon: "pin" as const,
            label: "Ubicación",
            value: [contact.address, contact.city].filter(Boolean).join(", "),
          },
        ]
      : []),
    ...(contact.schedule ? [{ icon: "clock" as const, label: "Horario", value: contact.schedule }] : []),
  ];

  return (
    <section id="contacto" aria-labelledby="contacto-title" className="pb-24">
      <Container>
        <div className="grid gap-10 rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-slate-100 sm:p-10 lg:grid-cols-2 lg:p-14">
          <div>
            <SectionHeading
              id="contacto-title"
              align="left"
              eyebrow="Contacto"
              title="Hablemos de lo que quieres proteger"
              description="La forma más rápida de comunicarte con nosotros es WhatsApp. Escríbenos y un asesor te responderá."
            />
            <ExternalButton
              href={whatsappUrl(undefined, current.whatsappNumber)}
              variant="whatsapp"
              size="lg"
              className="mt-8 w-full sm:w-auto"
            >
              <WhatsAppIcon className="size-5" />
              Hablar por WhatsApp
            </ExternalButton>
            <div className="mt-8">
              <SocialLinks />
            </div>
          </div>

          <ul className="space-y-4 self-center">
            {current.advisor && (
              <li className="flex items-center gap-4 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100">
                <AdvisorAvatar advisor={current.advisor} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Tu asesor</p>
                  <p className="text-lg font-bold wrap-anywhere text-ink">{current.advisor.name}</p>
                </div>
              </li>
            )}
            <li className="flex items-center gap-4 rounded-2xl bg-[#25d366]/10 p-5 ring-1 ring-[#25d366]/25">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-whatsapp text-white">
                <WhatsAppIcon className="size-6" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">WhatsApp</p>
                <a
                  href={whatsappUrl(undefined, current.whatsappNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-bold text-ink hover:text-brand-700"
                >
                  {current.whatsappDisplay}
                </a>
              </div>
            </li>
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-slate-100">
                  <Icon name={item.icon} className="size-5" />
                </span>
                {/* min-w-0 + wrap-anywhere: los valores largos (p. ej. el correo) no desbordan en celulares. */}
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="text-lg font-bold wrap-anywhere text-ink hover:text-brand-700">
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-lg font-bold wrap-anywhere text-ink">{item.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
