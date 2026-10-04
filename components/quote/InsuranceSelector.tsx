import Link from "next/link";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { cn } from "@/lib/format";
import type { InsuranceType } from "@/types";
import { Icon, INSURANCE_ICONS } from "@/components/ui/Icon";

/**
 * "¿Qué seguro necesitas?"
 * - variant "grid": tarjetas grandes (página /cotizar).
 * - variant "tabs": fila compacta desplazable (encima del formulario).
 */
export function InsuranceSelector({
  selected,
  variant = "grid",
}: {
  selected?: InsuranceType;
  variant?: "grid" | "tabs";
}) {
  if (variant === "tabs") {
    return (
      <nav aria-label="Tipo de seguro" className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-6">
          {INSURANCE_PRODUCTS.map((p) => {
            const active = p.id === selected;
            return (
              <li key={p.id}>
                <Link
                  href={`/cotizar/${p.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition-all sm:flex-col sm:gap-1.5 sm:px-2",
                    active
                      ? "bg-brand-600 text-white ring-brand-600 shadow-soft"
                      : "bg-white text-slate-600 ring-slate-200 hover:text-brand-700 hover:ring-brand-200",
                  )}
                >
                  <Icon name={INSURANCE_ICONS[p.id]} className="size-5 sm:size-6" />
                  {p.shortName}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {INSURANCE_PRODUCTS.map((p) => (
        <li key={p.id}>
          <Link
            href={`/cotizar/${p.id}`}
            className="group flex h-full flex-col items-start gap-4 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200 sm:p-6"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white sm:size-14">
              <Icon name={INSURANCE_ICONS[p.id]} className="size-6 sm:size-7" />
            </span>
            <span className="text-base font-bold text-ink sm:text-lg">{p.shortName}</span>
            <span className="hidden text-sm text-slate-600 sm:block">{p.description}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
              Cotizar <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
