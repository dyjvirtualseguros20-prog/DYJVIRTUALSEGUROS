import { heroContent } from "@/config/content";
import { INSURANCE_PRODUCTS } from "@/lib/insurance";
import { whatsappUrl } from "@/lib/whatsapp";
import { ButtonLink, ExternalButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon, INSURANCE_ICONS, WhatsAppIcon } from "@/components/ui/Icon";

export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white pt-32 pb-20 sm:pt-40 lg:pb-28"
    >
      {/* Fondo decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 size-[38rem] rounded-full border-[56px] border-brand-100/70" />
        <div className="absolute -top-24 -right-24 size-[30rem] rounded-full border border-brand-200/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(30_63_148/0.07)_1px,transparent_0)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      </div>

      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-soft ring-1 ring-brand-100">
            <Icon name="shield" className="size-4 text-brand-500" />
            {heroContent.eyebrow}
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl"
          >
            {heroContent.title.split(" ").slice(0, -2).join(" ")}{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              {heroContent.title.split(" ").slice(-2).join(" ")}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-slate-600 sm:text-xl">{heroContent.subtitle}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/cotizar" size="lg">
              {heroContent.primaryCta}
              <Icon name="arrowRight" className="size-5" />
            </ButtonLink>
            <ExternalButton href={whatsappUrl()} variant="secondary" size="lg">
              <WhatsAppIcon className="size-5 text-whatsapp" />
              {heroContent.secondaryCta}
            </ExternalButton>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
            {heroContent.trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Icon name="check" className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

/** Ilustración del proceso de cotización (no muestra precios para no sugerir ofertas reales). */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:150ms]" aria-hidden="true">
      <div className="rounded-3xl bg-white p-6 shadow-lift ring-1 ring-slate-100 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Tu cotización</p>
            <p className="mt-1 text-lg font-bold text-ink">¿Qué quieres proteger?</p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Icon name="shield" className="size-6" />
          </span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {INSURANCE_PRODUCTS.map((p, i) => (
            <div
              key={p.id}
              className={
                i === 0
                  ? "flex flex-col items-center gap-1.5 rounded-2xl bg-brand-600 py-3.5 text-white"
                  : "flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 py-3.5 text-slate-600"
              }
            >
              <Icon name={INSURANCE_ICONS[p.id]} className="size-6" />
              <span className="text-[11px] font-semibold">{p.shortName}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2.5">
          {["Opción 1", "Opción 2", "Opción 3"].map((label, i) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded-full bg-slate-200" style={{ width: `${70 - i * 12}%` }} />
                <div className="h-2 w-1/3 rounded-full bg-slate-100" />
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-slate-100 sm:-left-10">
        <span className="flex size-10 items-center justify-center rounded-full bg-whatsapp text-white">
          <WhatsAppIcon className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-ink">Asesor por WhatsApp</p>
          <p className="text-xs text-slate-500">Resolvemos tus dudas</p>
        </div>
      </div>

      <div className="absolute -top-5 -right-3 flex items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-xs font-semibold text-white shadow-lift sm:-right-6">
        <Icon name="layers" className="size-4 text-brand-200" />
        Compara opciones
      </div>
    </div>
  );
}
