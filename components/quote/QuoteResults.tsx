"use client";

import { formatCOP, formatDate } from "@/lib/format";
import { getProduct } from "@/lib/insurance";
import { whatsappUrl } from "@/lib/whatsapp";
import { REQUEST_STATUSES, type QuoteResponse } from "@/types";
import { Button, ExternalButton } from "@/components/ui/Button";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";

export function QuoteResults({ data, onRestart }: { data: QuoteResponse; onRestart: () => void }) {
  const { receipt, result } = data;
  const quotes = [...result.quotes].sort((a, b) => a.price - b.price);
  const product = quotes[0] ? getProduct(quotes[0].insuranceType) : null;
  const productName = product?.name.toLowerCase() ?? "seguro";

  const advisorMessage = `Hola, acabo de solicitar una cotización de ${productName} en la página web (referencia ${receipt.requestId}). Quiero hablar con un asesor.`;

  return (
    <div className="space-y-8">
      {/* Confirmación */}
      <div className="flex flex-col gap-4 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100 sm:flex-row sm:items-center sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Icon name="check" className="size-6" strokeWidth={2.5} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-ink">¡Recibimos tu solicitud!</h2>
          <p className="text-sm text-slate-600">
            Referencia <strong className="font-mono text-ink">{receipt.requestId}</strong> · Estado:{" "}
            {REQUEST_STATUSES[receipt.status]}. Un asesor podrá contactarte para confirmar los detalles.
          </p>
        </div>
      </div>

      {/* Aviso de datos demostrativos */}
      {result.isDemo && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          <Icon name="info" className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>Datos demostrativos.</strong> Las aseguradoras y los precios de esta lista son simulados y{" "}
            <strong>no corresponden a ofertas reales</strong>. Un asesor te compartirá las opciones definitivas.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-extrabold text-ink">Opciones encontradas</h3>
        <p className="mt-1 text-sm text-slate-500">Ordenadas de menor a mayor precio.</p>
      </div>

      <ul className="grid gap-4 lg:grid-cols-3">
        {quotes.map((quote, i) => {
          const choose = `Hola, me interesa la opción "${quote.planName}" de ${quote.insurer.name} para mi cotización de ${productName} (referencia ${receipt.requestId}).`;
          const featured = i === 1 && quotes.length > 2;
          return (
            <li
              key={quote.id}
              className={
                featured
                  ? "relative flex flex-col rounded-3xl bg-white p-6 shadow-lift ring-2 ring-brand-600"
                  : "relative flex flex-col rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200"
              }
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                  Opción intermedia
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-500">
                  {quote.insurer.name.replace(/^Aseguradora\s+/, "").charAt(0)}
                </span>
                <div>
                  <p className="font-bold text-ink">{quote.insurer.name}</p>
                  <p className="text-xs text-slate-500">{quote.planName}</p>
                </div>
              </div>

              <dl className="mt-6 space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-slate-500">Cobertura</dt>
                  <dd className="font-semibold text-ink">{quote.coverage}</dd>
                </div>
                <div className="pt-3">
                  <dt className="sr-only">Precio</dt>
                  <dd>
                    <span className="text-3xl font-extrabold tracking-tight text-ink">{formatCOP(quote.price)}</span>
                    <span className="ml-1 text-sm text-slate-500">/ {quote.period}</span>
                  </dd>
                </div>
              </dl>

              <ul className="mt-5 flex-1 space-y-2 border-t border-slate-100 pt-5 text-sm text-slate-600">
                {quote.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-500" strokeWidth={2.5} />
                    {h}
                  </li>
                ))}
              </ul>

              {quote.validUntil && (
                <p className="mt-4 text-xs text-slate-400">Vigencia de referencia: {formatDate(quote.validUntil)}</p>
              )}

              <ExternalButton
                href={whatsappUrl(choose)}
                variant={featured ? "primary" : "secondary"}
                className="mt-5 w-full"
              >
                Me interesa esta opción
              </ExternalButton>
            </li>
          );
        })}
      </ul>

      {/* Siguiente paso: contactar asesor */}
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-brand-900 p-6 text-center sm:p-10">
        <div>
          <h3 className="text-xl font-extrabold text-white sm:text-2xl">¿Quieres que un asesor revise tu caso?</h3>
          <p className="mt-2 text-brand-100/80">
            Te explicamos cada opción y resolvemos tus dudas antes de que tomes una decisión.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ExternalButton href={whatsappUrl(advisorMessage)} variant="whatsapp" size="lg">
            <WhatsAppIcon className="size-5" />
            Hablar con un asesor
          </ExternalButton>
          <Button variant="light" size="lg" onClick={onRestart}>
            Hacer otra cotización
          </Button>
        </div>
      </div>
    </div>
  );
}
