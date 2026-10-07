"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mainNav } from "@/config/navigation";
import { cn } from "@/lib/format";
import { ADVISOR_LINES } from "@/lib/whatsapp";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cierra el menú móvil al cambiar de página.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Bloquea el scroll de la página mientras el menú móvil está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled || open ? "bg-white/90 shadow-[0_1px_0_rgb(15_23_42/0.06)] backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <Container className="flex h-18 items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ButtonLink href="/cotizar">
                Cotizar ahora
                <Icon name="arrowRight" className="size-4" />
              </ButtonLink>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-brand-50 lg:hidden"
              aria-expanded={open}
              aria-controls="menu-movil"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
              <Icon name={open ? "close" : "menu"} className="size-6" />
            </button>
          </div>
        </Container>
      </header>

      {/* Menú móvil: fuera del <header> porque backdrop-blur crearía un contenedor para los elementos fixed. */}
      <div
        id="menu-movil"
        className={cn(
          "fixed inset-x-0 top-18 bottom-0 z-[45] bg-white transition-all duration-300 lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <Container className="flex h-full flex-col pt-4 pb-24">
          <nav aria-label="Menú móvil">
            <ul className="divide-y divide-slate-100">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-4 text-lg font-semibold text-ink"
                  >
                    {item.label}
                    <Icon name="arrowRight" className="size-5 text-brand-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* Los dos números oficiales: fáciles de tocar desde el celular. */}
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">Habla con uno de nuestros asesores</p>
            <ul className="mt-3 space-y-2">
              {ADVISOR_LINES.map((line) => (
                <li key={line.number} className="flex items-center justify-between gap-3">
                  <a href={line.telHref} className="py-1.5 text-base font-bold text-brand-700">
                    📞 {line.display}
                  </a>
                  <a
                    href={line.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${line.display}`}
                    className="flex size-10 items-center justify-center rounded-full bg-whatsapp text-white"
                  >
                    <WhatsAppIcon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/cotizar" size="lg" className="mt-auto w-full" onClick={() => setOpen(false)}>
            Cotizar ahora
          </ButtonLink>
        </Container>
      </div>
    </>
  );
}
