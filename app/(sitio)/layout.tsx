import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";

/** Layout del sitio público (todas las páginas excepto /admin). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
