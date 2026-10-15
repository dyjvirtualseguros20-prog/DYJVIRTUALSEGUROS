import type { ReactNode } from "react";
import { AssistantLauncher } from "@/components/chat/AssistantLauncher";
import { CookieYes } from "@/components/legal/CookieYes";
import { GoogleAnalytics } from "@/components/legal/GoogleAnalytics";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { WhatsAppFloat } from "./WhatsAppFloat";

/** Estructura del sitio público: encabezado, contenido, pie de página, WhatsApp flotante, asesor virtual y banner de cookies. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <AssistantLauncher />
      <CookieYes />
      <GoogleAnalytics />
    </>
  );
}
