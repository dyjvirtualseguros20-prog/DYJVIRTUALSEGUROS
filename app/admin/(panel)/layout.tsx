import type { ReactNode } from "react";
import { requireAdmin } from "@/server/auth";
import { getBackend } from "@/server/env";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

// Datos privados y siempre actualizados: nunca se prerenderizan ni se cachean.
export const dynamic = "force-dynamic";

/** Todas las páginas del panel exigen sesión de asesor (verificada en el servidor). */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const devMode = getBackend() === "local";

  return (
    <>
      <AdminHeader email={session.email} />
      {devMode && (
        <div className="border-b border-amber-200 bg-amber-50">
          <Container className="flex items-start gap-2 py-2.5 text-xs text-amber-900 sm:items-center">
            <Icon name="info" className="mt-0.5 size-4 shrink-0 sm:mt-0" />
            <p>
              <strong>Modo desarrollo:</strong> las solicitudes se guardan en <code>.data/quote-requests.json</code>.
              Configura Supabase en <code>.env.local</code> para usar la base de datos real.
            </p>
          </Container>
        </div>
      )}
      <main id="contenido" className="pb-20">
        {children}
      </main>
    </>
  );
}
