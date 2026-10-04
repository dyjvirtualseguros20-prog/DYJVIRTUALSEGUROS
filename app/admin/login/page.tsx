import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/auth";
import { getBackend, supabaseConfigProblems } from "@/server/env";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (await getAdminSession()) redirect("/admin");
  const { next } = await searchParams;
  const backend = getBackend();
  const problems = supabaseConfigProblems();

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-8 rounded-3xl bg-white p-7 shadow-lift ring-1 ring-slate-100">
          <h1 className="text-xl font-extrabold text-ink">Panel del asesor</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta para ver las solicitudes.</p>
          <LoginForm next={next ?? "/admin"} />
        </div>
        {backend === "local" && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
            <strong>Modo desarrollo:</strong> usa ADMIN_DEV_EMAIL y ADMIN_DEV_PASSWORD de <code>.env.local</code>.
          </p>
        )}
        {backend === "none" && (
          <div className="mt-4 rounded-2xl bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-200">
            <p className="font-bold">La conexión con Supabase no está completa:</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {(problems.length ? problems : ["Faltan las variables de Supabase en el servidor."]).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-1.5">Corrige el archivo .env.local y reinicia el servidor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
