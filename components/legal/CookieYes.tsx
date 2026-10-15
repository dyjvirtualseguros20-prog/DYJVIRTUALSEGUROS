import Script from "next/script";

/**
 * Banner de consentimiento de cookies (CookieYes), código oficial para dyjvirtualseguros.com.
 * Solo se carga en el sitio público (components/layout/SiteShell.tsx), nunca en /admin.
 * El id "cookieyes" evita que el script se cargue dos veces al navegar entre páginas.
 * Las cookies necesarias (asesor, sesión de Supabase) y el aviso del chat no dependen de este banner.
 */
const COOKIEYES_SRC = "https://cdn-cookieyes.com/client_data/5321c871a9cde26c6836c33f3be0ef58/script.js";

export function CookieYes() {
  return <Script id="cookieyes" src={COOKIEYES_SRC} strategy="afterInteractive" />;
}
