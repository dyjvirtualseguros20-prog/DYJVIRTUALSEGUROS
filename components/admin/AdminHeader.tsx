import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

export function AdminHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Logo className="hidden sm:flex" />
          <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <Link href="/admin" className="text-sm font-bold text-ink">
            Panel del asesor
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-48 truncate text-xs text-slate-500 md:block" title={email}>
            {email}
          </span>
          <Link
            href="/"
            className="hidden rounded-full px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:block"
          >
            Ver sitio
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            >
              <Icon name="lock" className="size-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </Container>
    </header>
  );
}
