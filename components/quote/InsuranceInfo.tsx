import Link from "next/link";
import { siteConfig } from "@/config/site";
import { INSURANCE_PRODUCTS, type InsuranceProduct } from "@/lib/insurance";
import { Icon, INSURANCE_ICONS } from "@/components/ui/Icon";

/**
 * Información del seguro debajo del formulario (/cotizar/[tipo]).
 * Explica el producto en términos generales y enlaza a los demás seguros.
 */
export function InsuranceInfo({ product }: { product: InsuranceProduct }) {
  const { info } = product;
  const others = INSURANCE_PRODUCTS.filter((p) => p.id !== product.id);

  return (
    <section aria-labelledby="info-title" className="mt-14 space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-slate-100 sm:p-10">
        <h2 id="info-title" className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {info.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">{info.intro}</p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-base font-bold text-ink">Coberturas que puedes encontrar</h3>
            <ul className="mt-4 space-y-2.5">
              {info.coverages.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] text-slate-600">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Icon name="check" className="size-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              Las coberturas, los deducibles y los precios dependen de cada aseguradora y del plan que elijas.
            </p>
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Cómo te ayudamos</h3>
            <ul className="mt-4 space-y-2.5 text-[15px] text-slate-600">
              <li>Comparamos opciones de diferentes aseguradoras según tus necesidades y tu presupuesto.</li>
              <li>Un asesor te explica cada alternativa en un lenguaje sencillo antes de decidir.</li>
              <li>
                Atención virtual en toda Colombia y, si lo prefieres, cita presencial en Bogotá o visita a tu
                domicilio dentro de la ciudad, previa coordinación.
              </li>
              {siteConfig.contact.schedule && (
                <li>Asesoría y cotizaciones: {siteConfig.contact.schedule.toLowerCase()}</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-slate-100 sm:p-10">
        <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          Preguntas frecuentes: {product.name.toLowerCase()}
        </h2>
        <dl className="mt-6 space-y-5">
          {info.faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-labelledby="otros-seguros" className="rounded-[2rem] bg-slate-50 p-6 sm:p-10">
        <h2 id="otros-seguros" className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          Otros seguros que puedes cotizar
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((p) => (
            <li key={p.id}>
              <Link
                href={`/cotizar/${p.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-ink ring-1 ring-slate-100 transition-colors hover:text-brand-700 hover:ring-brand-200"
              >
                <Icon name={INSURANCE_ICONS[p.id]} className="size-5 text-brand-600" />
                Cotizar {p.name.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
