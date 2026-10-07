import { siteConfig } from "@/config/site";
import { ADVISOR_LINES, whatsappUrl, type ContactInfo } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { ExternalButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";
import { AdvisorAvatar } from "@/components/ui/AdvisorAvatar";
import { Icon, WhatsAppIcon, type IconName } from "@/components/ui/Icon";

export async function Contact() {
  const { contact } = siteConfig;
  // Botón principal de WhatsApp: el del asesor del enlace (/cristian, ...) o el de la empresa.
  const current = await getCurrentContact();
  // Asesor de un enlace cuyo número no es uno de los oficiales (asesores futuros): se muestra aparte.
  const ownLine = current.advisor && !ADVISOR_LINES.some((l) => l.number === current.whatsappNumber) ? current : null;

  // Solo se muestran los datos que estén configurados en config/site.ts.
  const items: Array<{ icon: IconName; label: string; value: string; href?: string }> = [
    ...(contact.secondaryPhone
      ? [{ icon: "phone" as const, label: "Teléfono adicional", value: contact.secondaryPhone }]
      : []),
    ...(contact.email
      ? [{ icon: "mail" as const, label: "Correo", value: contact.email, href: `mailto:${contact.email}` }]
      : []),
    ...(contact.serviceArea || contact.city || contact.address
      ? [
          {
            icon: "pin" as const,
            label: "Ubicación",
            value: contact.serviceArea || [contact.address, contact.city].filter(Boolean).join(", "),
          },
        ]
      : []),
    ...(contact.schedule
      ? [{ icon: "clock" as const, label: "Asesoría y cotizaciones", value: contact.schedule }]
      : []),
    ...(contact.urgentSupport
      ? [{ icon: "shield" as const, label: "Orientación ante accidentes", value: contact.urgentSupport }]
      : []),
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
              title="¿Necesitas información o quieres cotizar tu seguro?"
              description="Nuestro equipo está listo para ayudarte. Llámanos o escríbenos por WhatsApp y un asesor te atenderá."
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
            {/* Los dos números oficiales de los asesores: llamada y WhatsApp. */}
            <li className="rounded-2xl bg-[#25d366]/10 p-5 ring-1 ring-[#25d366]/25">
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-whatsapp text-white">
                  <Icon name="phone" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Asesores</p>
                  <p className="text-lg font-bold text-ink">Habla con uno de nuestros asesores</p>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {[...ADVISOR_LINES, ...(ownLine ? [advisorLine(ownLine)] : [])].map((line) => (
                  <li
                    key={line.number}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-white px-4 py-3 ring-1 ring-[#25d366]/20"
                  >
                    <a href={line.telHref} className="text-lg font-bold text-ink hover:text-brand-700">
                      📞 {line.display}
                    </a>
                    <span className="flex gap-2">
                      <a
                        href={line.telHref}
                        aria-label={`Llamar al ${line.display}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        <Icon name="phone" className="size-4" />
                        Llamar
                      </a>
                      <a
                        href={line.whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Escribir por WhatsApp al ${line.display}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-whatsapp px-4 text-sm font-semibold text-white hover:brightness-95"
                      >
                        <WhatsAppIcon className="size-4" />
                        WhatsApp
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-slate-600">
                Ambos números están disponibles para información y cotizaciones.
              </p>
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

/** Número propio de un asesor del enlace que no es uno de los oficiales. */
function advisorLine(contact: ContactInfo) {
  return {
    number: contact.whatsappNumber,
    display: contact.whatsappDisplay,
    telHref: `tel:${contact.phoneHref}`,
    whatsappHref: whatsappUrl(undefined, contact.whatsappNumber),
  };
}
