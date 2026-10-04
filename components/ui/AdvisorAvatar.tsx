import { cn } from "@/lib/format";
import type { Advisor } from "@/types";

/** Foto del asesor o, si no tiene, sus iniciales. */
export function AdvisorAvatar({ advisor, className }: { advisor: Advisor; className?: string }) {
  const initials = advisor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (advisor.photoUrl) {
    return (
      // La foto puede venir de cualquier URL https configurada en Supabase.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={advisor.photoUrl}
        alt={`Foto de ${advisor.name}`}
        className={cn("size-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-100", className)}
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-extrabold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}
