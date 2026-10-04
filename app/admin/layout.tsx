import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Panel del asesor", template: "%s | Panel del asesor" },
  robots: { index: false, follow: false },
};

/** Layout base del panel (incluye /admin/login). La protección está en app/admin/(panel)/layout.tsx y proxy.ts. */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-slate-50">{children}</div>;
}
