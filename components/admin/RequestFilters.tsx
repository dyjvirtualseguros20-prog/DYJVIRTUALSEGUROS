import Link from "next/link";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { NO_ADVISOR, REQUEST_STATUSES, type Advisor } from "@/types";
import { Icon } from "@/components/ui/Icon";

const control =
  "block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";

/** Filtros del listado. Formulario GET: funciona sin JavaScript y la URL se puede compartir. */
export function RequestFilters({
  tipo,
  estado,
  desde,
  hasta,
  asesor,
  advisors,
}: {
  tipo: string;
  estado: string;
  desde: string;
  hasta: string;
  asesor: string;
  advisors: Advisor[];
}) {
  return (
    <form
      method="get"
      action="/admin"
      className="mt-6 grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
    >
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-500">Tipo de seguro</span>
        <select name="tipo" defaultValue={tipo} className={control}>
          <option value="">Todos</option>
          {INSURANCE_PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shortName}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-500">Estado</span>
        <select name="estado" defaultValue={estado} className={control}>
          <option value="">Todos</option>
          {Object.entries(REQUEST_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-500">Asesor</span>
        <select name="asesor" defaultValue={asesor} className={control}>
          <option value="">Todos</option>
          {advisors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.active ? "" : " (inactivo)"}
            </option>
          ))}
          <option value={NO_ADVISOR}>Sin asesor</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-500">Desde</span>
        <input type="date" name="desde" defaultValue={desde} className={control} />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-500">Hasta</span>
        <input type="date" name="hasta" defaultValue={hasta} className={control} />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button
          type="submit"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 lg:flex-none"
        >
          <Icon name="layers" className="size-4" />
          Filtrar
        </button>
        <Link
          href="/admin"
          className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}
