import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/format";

/**
 * Logo + nombre de la empresa.
 * Usa siteConfig.logo; si `src` está vacío muestra un marcador TEMPORAL.
 */
export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const { logo, name } = siteConfig;
  const light = tone === "light";

  return (
    <Link href="/" className={cn("group flex items-center gap-3", className)} aria-label={`${name} — Inicio`}>
      {logo.src ? (
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 ring-1 ring-slate-200">
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            className="h-full w-full object-contain"
            priority
          />
        </span>
      ) : (
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-[9px] font-bold leading-tight text-brand-600"
          title="Logo temporal: configura siteConfig.logo.src"
        >
          TU
          <br />
          LOGO
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span
          className={cn("text-base font-extrabold tracking-tight whitespace-nowrap", light ? "text-white" : "text-ink")}
        >
          {name}
        </span>
        <span className={cn("text-[11px] font-medium", light ? "text-brand-200" : "text-slate-500")}>
          Agencia de seguros
        </span>
      </span>
    </Link>
  );
}
