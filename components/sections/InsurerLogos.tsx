import Image from "next/image";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";

/**
 * Franja de logos de aseguradoras.
 * Solo se muestra si siteConfig.insurerLogos.show === true (desactivada por defecto
 * para no afirmar alianzas que no estén confirmadas).
 */
export function InsurerLogos() {
  const { show, title, items } = siteConfig.insurerLogos;
  if (!show) return null;

  return (
    <section aria-label={title} className="border-y border-slate-100 bg-white py-12">
      <Container>
        <p className="text-center text-sm font-semibold text-slate-500">{title}</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {items.map((item) => (
            <li key={item.name} className="relative h-12 w-32">
              <Image src={item.src} alt={item.name} fill sizes="128px" className="object-contain" />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
