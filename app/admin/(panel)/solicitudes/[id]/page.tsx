import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clientWhatsappUrl, describeFormData, formatPhone } from "@/lib/admin";
import { formatDateTime, toLocalInputValue } from "@/lib/datetime";
import { formatCOP } from "@/lib/format";
import { getProduct } from "@/lib/insurance";
import { listAdvisors } from "@/server/advisors";
import { getQuoteRequest } from "@/server/quoteRequests";
import { REQUEST_SOURCES } from "@/types";
import { RequestManageForm } from "@/components/admin/RequestManageForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ExternalButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon, INSURANCE_ICONS, WhatsAppIcon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Solicitud" };

type Props = { params: Promise<{ id: string }> };

function DataList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd className="text-sm font-semibold break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function RequestDetailPage({ params }: Props) {
  const { id } = await params;
  const request = await getQuoteRequest(id);
  if (!request) notFound();

  const product = getProduct(request.insuranceType);
  // Asesor que originó la visita (fijado al registrar la solicitud; no se puede editar).
  const advisor = request.advisorId ? ((await listAdvisors()).find((a) => a.id === request.advisorId) ?? null) : null;
  const advisorText = request.advisorId
    ? `${advisor?.name ?? request.advisorId} (enlace /${request.advisorId})`
    : "Sin asesor (llegó sin enlace de asesor)";

  const contactItems = [
    { label: "Nombre completo", value: request.fullName },
    ...(request.identification
      ? [{ label: request.insuranceType === "empresas" ? "NIT" : "Identificación", value: request.identification }]
      : []),
    {
      label: "Teléfono",
      value: (
        <a href={`tel:+57${request.phone}`} className="text-brand-700 hover:underline">
          {formatPhone(request.phone)}
        </a>
      ),
    },
    { label: "WhatsApp", value: `+${request.whatsapp}` },
    {
      label: "Correo",
      value: (
        <a href={`mailto:${request.email}`} className="text-brand-700 hover:underline">
          {request.email}
        </a>
      ),
    },
    ...(request.city ? [{ label: "Ciudad", value: request.city }] : []),
  ];

  // Los datos de contacto ya se muestran arriba; aquí van solo los del seguro.
  const detailItems = describeFormData(request, ["documentNumber", "nit", "city"]);

  return (
    <Container className="max-w-6xl pt-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
      >
        <Icon name="arrowLeft" className="size-4" />
        Volver a las solicitudes
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Icon name={INSURANCE_ICONS[request.insuranceType]} className="size-6" />
          </span>
          <div>
            <p className="font-mono text-xs font-semibold text-brand-700">{request.reference}</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{request.fullName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {product.name} · Recibida el {formatDateTime(request.createdAt)} · Asesor:{" "}
              <strong className="font-semibold text-ink">{advisor?.name ?? request.advisorId ?? "Sin asesor"}</strong>
              <StatusBadge status={request.status} />
            </p>
          </div>
        </div>
        <ExternalButton href={clientWhatsappUrl(request)} variant="whatsapp" className="w-full sm:w-auto">
          <WhatsAppIcon className="size-5" />
          Contactar por WhatsApp
        </ExternalButton>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section aria-labelledby="datos-cliente" className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
            <h2 id="datos-cliente" className="text-base font-bold text-ink">
              Datos del cliente
            </h2>
            <DataList items={contactItems} />
          </section>

          <section aria-labelledby="datos-seguro" className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
            <h2 id="datos-seguro" className="text-base font-bold text-ink">
              Datos de la solicitud · {product.name}
            </h2>
            {detailItems.length > 0 ? (
              <DataList items={detailItems} />
            ) : (
              <p className="mt-3 text-sm text-slate-500">Sin datos adicionales.</p>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 text-xs text-slate-500 ring-1 ring-slate-200">
            <DataList
              items={[
                { label: "Asesor", value: advisorText },
                { label: "Origen", value: REQUEST_SOURCES[request.source] },
                { label: "ID interno", value: <span className="font-mono text-xs">{request.id}</span> },
                { label: "Última actualización", value: formatDateTime(request.updatedAt) },
                {
                  label: "Cotización registrada",
                  value: request.quoteAmount !== null ? formatCOP(request.quoteAmount) : "Sin registrar",
                },
                {
                  label: "Fecha de contacto",
                  value: request.contactedAt ? formatDateTime(request.contactedAt) : "Sin contactar",
                },
              ]}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <RequestManageForm
            id={request.id}
            initial={{
              status: request.status,
              advisorNotes: request.advisorNotes ?? "",
              quoteAmount: request.quoteAmount !== null ? String(request.quoteAmount) : "",
              contactedAt: toLocalInputValue(request.contactedAt),
            }}
          />
        </aside>
      </div>
    </Container>
  );
}
