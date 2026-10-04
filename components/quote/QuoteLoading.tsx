import { Icon } from "@/components/ui/Icon";

export function QuoteLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-14 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <Icon name="shield" className="size-10 text-brand-600" />
      </div>
      <h2 className="mt-8 text-2xl font-extrabold text-ink">Estamos buscando las mejores opciones para ti…</h2>
      <p className="mt-3 max-w-md text-slate-600">Estamos revisando tu solicitud. Esto solo tomará unos segundos.</p>
      <ul className="mt-8 space-y-3 text-left text-sm text-slate-600">
        {["Solicitud recibida", "Consultando alternativas", "Preparando tus opciones"].map((step, i) => (
          <li key={step} className="flex animate-fade-up items-center gap-3" style={{ animationDelay: `${i * 600}ms` }}>
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Icon name="check" className="size-3.5" strokeWidth={3} />
            </span>
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
