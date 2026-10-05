import type { ReactNode } from "react";

/** Marcador visible para datos de la empresa que aún faltan. Nunca se inventan. */
export function PorCompletar({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-300">
      [POR COMPLETAR: {children}]
    </mark>
  );
}

/** Valor configurado o el marcador [POR COMPLETAR]. */
export const dato = (value: string, label: string) => (value ? value : <PorCompletar>{label}</PorCompletar>);

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Estilos compartidos del cuerpo de los documentos legales. */
export const LEGAL_PROSE =
  "mt-10 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline";

/** Índice de secciones. */
export function LegalToc({ sections }: { sections: ReadonlyArray<readonly [string, string]> }) {
  return (
    <nav aria-label="Contenido" className="mt-8">
      <p className="text-sm font-bold text-ink">Contenido</p>
      <ol className="mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-sm text-brand-700 sm:grid-cols-2">
        {sections.map(([id, title]) => (
          <li key={id}>
            <a href={`#${id}`} className="hover:underline">
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
