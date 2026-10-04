import { SiteShell } from "@/components/layout/SiteShell";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <SiteShell>
      <section className="flex min-h-[70vh] items-center pt-24">
        <Container className="max-w-xl text-center">
          <p className="text-sm font-bold tracking-[0.18em] text-brand-500 uppercase">Error 404</p>
          <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">No encontramos esta página</h1>
          <p className="mt-4 text-slate-600">
            Es posible que el enlace haya cambiado. Puedes volver al inicio o cotizar tu seguro.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/">Volver al inicio</ButtonLink>
            <ButtonLink href="/cotizar" variant="secondary">
              Cotizar ahora
            </ButtonLink>
          </div>
        </Container>
      </section>
    </SiteShell>
  );
}
