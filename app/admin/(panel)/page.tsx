import type { Metadata } from "next";
import Link from "next/link";
import { formatPhone } from "@/lib/admin";
import { formatDateTime } from "@/lib/datetime";
import { getProduct } from "@/lib/insurance";
import { listAdvisors } from "@/server/advisors";
import { listQuoteRequests } from "@/server/quoteRequests";
import { isInsuranceType, isRequestStatus, NO_ADVISOR, type QuoteRequestFilters } from "@/types";
import { RequestFilters } from "@/components/admin/RequestFilters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Container } from "@/components/ui/Container";
import { Icon, INSURANCE_ICONS } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Solicitudes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminRequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tipo = one(params.tipo);
  const estado = one(params.estado);
  const desde = one(params.desde);
  const hasta = one(params.hasta);
  const asesor = one(params.asesor);

  const advisors = await listAdvisors();
  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));
  /** Nombre del asesor (o su id si ya no existe), o "Sin asesor". */
  const advisorLabel = (id: string | null) => (id ? (advisorName.get(id) ?? id) : "Sin asesor");

  const filters: QuoteRequestFilters = {
    insuranceType: isInsuranceType(tipo) ? tipo : undefined,
    status: isRequestStatus(estado) ? estado : undefined,
    from: DATE.test(desde) ? desde : undefined,
    to: DATE.test(hasta) ? hasta : undefined,
    advisorId: asesor === NO_ADVISOR || advisorName.has(asesor) ? asesor : undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const requests = await listQuoteRequests(filters);

  return (
    <Container className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Solicitudes de cotización</h1>
          <p className="mt-1 text-sm text-slate-500">
            {requests.length === 1 ? "1 solicitud" : `${requests.length} solicitudes`}
            {hasFilters ? " con los filtros aplicados" : ""}
          </p>
        </div>
      </div>

      <RequestFilters
        tipo={filters.insuranceType ?? ""}
        estado={filters.status ?? ""}
        desde={filters.from ?? ""}
        hasta={filters.to ?? ""}
        asesor={filters.advisorId ?? ""}
        advisors={advisors}
      />

      {requests.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-slate-200">
          <Icon name="layers" className="size-10 text-slate-300" />
          <p className="mt-4 font-bold text-ink">
            {hasFilters ? "No hay solicitudes con estos filtros" : "Aún no hay solicitudes"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {hasFilters
              ? "Prueba con otros filtros o límpialos."
              : "Cuando un cliente envíe un formulario desde /cotizar aparecerá aquí."}
          </p>
        </div>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="mt-6 hidden overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    ID
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Fecha
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Cliente
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Tipo de seguro
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Ciudad
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Teléfono
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Asesor
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="group relative transition-colors hover:bg-brand-50/50">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-brand-700">
                      {/* El enlace cubre toda la fila */}
                      <Link
                        href={`/admin/solicitudes/${r.id}`}
                        className="after:absolute after:inset-0"
                        aria-label={`Abrir solicitud ${r.reference} de ${r.fullName}`}
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatDateTime(r.createdAt)}</td>
                    <td className="px-5 py-4 font-semibold text-ink">{r.fullName}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Icon name={INSURANCE_ICONS[r.insuranceType]} className="size-4 text-brand-500" />
                        {getProduct(r.insuranceType).shortName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{r.city ?? "—"}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatPhone(r.phone)}</td>
                    <td className={r.advisorId ? "px-5 py-4 font-semibold text-ink" : "px-5 py-4 text-slate-400"}>
                      {advisorLabel(r.advisorId)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="mt-6 space-y-3 md:hidden">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/solicitudes/${r.id}`}
                  className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 active:bg-brand-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{r.fullName}</p>
                      <p className="mt-0.5 font-mono text-xs text-brand-700">{r.reference}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                    <div>
                      <dt className="sr-only">Tipo de seguro</dt>
                      <dd>{getProduct(r.insuranceType).shortName}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Ciudad</dt>
                      <dd>{r.city ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Fecha</dt>
                      <dd>{formatDateTime(r.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Teléfono</dt>
                      <dd>{formatPhone(r.phone)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="inline">Asesor: </dt>
                      <dd className={r.advisorId ? "inline font-semibold text-ink" : "inline"}>
                        {advisorLabel(r.advisorId)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Container>
  );
}
