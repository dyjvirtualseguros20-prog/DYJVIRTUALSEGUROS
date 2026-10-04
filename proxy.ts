/**
 * Protección de /admin (Next.js 16: "proxy" reemplaza a "middleware").
 *
 * Primera barrera: sin sesión válida → redirige a /admin/login.
 * Además, cada página y acción del panel vuelve a comprobar la sesión y el rol
 * de asesor en el servidor (server/auth.ts → requireAdmin), y con Supabase la
 * base de datos aplica Row Level Security.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/server/devSession";
import { getBackend, supabaseEnv } from "@/server/env";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  let response = NextResponse.next({ request });
  let authenticated = false;

  const backend = getBackend();
  if (backend === "supabase") {
    // Renueva la sesión de Supabase y propaga las cookies actualizadas.
    const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  } else if (backend === "local") {
    authenticated = Boolean(verifyDevSession(request.cookies.get(DEV_SESSION_COOKIE)?.value));
  }

  if (!authenticated && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
