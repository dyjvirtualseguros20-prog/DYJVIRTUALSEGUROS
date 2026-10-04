import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen para compartir en redes (Open Graph), generada con los datos de config/site.ts. */
export default async function OpengraphImage() {
  const { colors } = siteConfig;
  let logoSrc: string | null = null;
  if (siteConfig.logo.src) {
    try {
      const data = await readFile(join(process.cwd(), "public", siteConfig.logo.src));
      logoSrc = `data:image/png;base64,${data.toString("base64")}`;
    } catch {
      logoSrc = null;
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "70px 80px",
        background: `linear-gradient(135deg, ${colors.brand900} 0%, ${colors.brand600} 100%)`,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
        <div style={{ fontSize: 28, opacity: 0.8, letterSpacing: 4, textTransform: "uppercase" }}>
          {siteConfig.name}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>{siteConfig.tagline}</div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 28 }}>
          Vehículos · Vida · Hogar · Salud · Viajes · Empresas
        </div>
      </div>
      {logoSrc && (
        <div style={{ display: "flex", background: "white", borderRadius: 40, padding: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={300} height={295} alt="" />
        </div>
      )}
    </div>,
    size,
  );
}
