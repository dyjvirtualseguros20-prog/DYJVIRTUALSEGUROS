import Link from "next/link";
import { mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { SocialLinks } from "./SocialLinks";

export async function Footer() {
  const current = await getCurrentContact();
  const year = new Date().getFullYear();
  const { contact } = siteConfig;

  return (
    <footer className="bg-brand-900 text-brand-100/80">
      <Container className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo tone="light" />
          <p className="max-w-xs text-sm">{siteConfig.description}</p>
          <SocialLinks tone="light" />
        </div>

        <nav aria-label="Seguros">
          <h3 className="mb-4 text-sm font-bold text-white">Seguros</h3>
          <ul className="space-y-2.5 text-sm">
            {INSURANCE_PRODUCTS.map((p) => (
              <li key={p.id}>
                <Link href={`/cotizar/${p.id}`} className="hover:text-white">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Enlaces">
          <h3 className="mb-4 text-sm font-bold text-white">Enlaces</h3>
          <ul className="space-y-2.5 text-sm">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/politica-de-privacidad" className="hover:text-white">
                Política de tratamiento de datos
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h3 className="mb-4 text-sm font-bold text-white">Contacto</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <a
                href={whatsappUrl(undefined, current.whatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                WhatsApp: {current.whatsappDisplay}
                {current.advisor ? ` (${current.advisor.name})` : ""}
              </a>
            </li>
            {contact.secondaryPhone && <li>Teléfono: {contact.secondaryPhone}</li>}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="hover:text-white">
                  {contact.email}
                </a>
              </li>
            )}
            {contact.city && <li>{contact.city}</li>}
            {contact.schedule && <li>{contact.schedule}</li>}
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.legalName}. Todos los derechos reservados.
          </p>
          <p className="text-brand-200/60">Las cotizaciones están sujetas a las condiciones de cada aseguradora.</p>
        </Container>
      </div>
    </footer>
  );
}
