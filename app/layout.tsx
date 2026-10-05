import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { siteConfig, siteUrl } from "@/config/site";
import { HOME_TITLE } from "@/lib/seo";
import "@/styles/globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

/**
 * Metadatos base. Cada página pública define su propio título, descripción, URL
 * canónica y vista previa con lib/seo.ts → pageMetadata(). Aquí no se fija una URL
 * canónica ni "index" para que no se hereden en la página 404 ni en /admin.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: HOME_TITLE,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: HOME_TITLE,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: siteConfig.colors.brand600,
  width: "device-width",
  initialScale: 1,
};

/** Variables CSS con los colores de config/site.ts (las usa Tailwind: brand-*, accent, ink…). */
const brandVars = Object.fromEntries(
  Object.entries(siteConfig.colors).map(([key, value]) => [`--c-${key}`, value]),
) as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={jakarta.variable} style={brandVars} suppressHydrationWarning>
      <head>
        {/* Activa las animaciones de aparición solo si hay JavaScript. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      {/* Header, footer y WhatsApp flotante: app/(sitio)/layout.tsx. El panel usa app/admin/layout.tsx. */}
      <body className="font-sans">{children}</body>
    </html>
  );
}
