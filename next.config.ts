import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Solo en desarrollo (next dev): da acceso a los bindings de wrangler.jsonc, por ejemplo
// Workers AI (env.AI), que siempre se ejecuta en la cuenta de Cloudflare (usa wrangler login).
if (process.env.NODE_ENV === "development") void initOpenNextCloudflareForDev();

/**
 * Dominio oficial (de NEXT_PUBLIC_SITE_URL). Cualquier otra dirección que sirva la
 * misma web (.workers.dev, .vercel.app) se marca "noindex" para que Google solo
 * muestre el dominio oficial, y www.dominio redirige al dominio sin www.
 */
const officialHost = (() => {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host;
    return host && !host.startsWith("localhost") ? host : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Raíz explícita: evita que Next.js tome el package-lock.json de la carpeta superior.
  turbopack: { root: path.join(__dirname) },
  async redirects() {
    if (!officialHost) return [];
    const www = [{ type: "host" as const, value: `www.${officialHost}` }];
    return [
      // La portada va aparte: en Cloudflare, "/:path*" vacío no se reemplaza en el destino.
      { source: "/", has: www, destination: `https://${officialHost}/`, permanent: true },
      {
        source: "/:path+",
        has: www,
        destination: `https://${officialHost}/:path+`,
        permanent: true,
      },
    ];
  },
  async headers() {
    const noindexElsewhere = officialHost
      ? [
          {
            source: "/:path*",
            missing: [{ type: "host" as const, value: officialHost }],
            headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
          },
        ]
      : [];
    // Cabeceras de seguridad básicas para todo el sitio.
    return [
      ...noindexElsewhere,
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
