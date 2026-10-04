/**
 * PROXY (Next.js 16: "proxy" reemplaza a "middleware"). Dos funciones:
 *
 * 1) Protección de /admin. Primera barrera: sin sesión válida → /admin/login.
 *    Además, cada página y acción del panel vuelve a comprobar la sesión y el rol
 *    de asesor en el servidor (server/auth.ts → requireAdmin), y con Supabase la
 *    base de datos aplica Row Level Security.
 *
 * 2) Enlaces de asesor: /cristian  o  /?asesor=cristian
 *    Si el asesor existe y está activo, se guarda en la cookie "asesor" (30 días,
 *    httpOnly) y se redirige a la misma página sin el identificador. A partir de
 *    ahí toda la navegación y las solicitudes quedan atribuidas a ese asesor.
 *    Un identificador que no existe se ignora (y /algo-inexistente da 404 normal).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADVISOR_COOKIE, ADVISOR_COOKIE_DAYS, ADVISOR_QUERY_PARAM, normalizeAdvisorId } from "@/lib/advisorLink";
import { isActiveAdvisor } from "@/server/advisorLookup";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/server/devSession";
import { getBackend, supabaseEnv } from "@/server/env";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return protectAdmin(request);
  return handleAdvisorLink(request);
}

/* ─────────────────────────────── Enlaces de asesor ─────────────────────────────── */

async function handleAdvisorLink(request: NextRequest) {
  const url = request.nextUrl;
  const fromQuery = url.searchParams.has(ADVISOR_QUERY_PARAM);
  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = fromQuery ? url.searchParams.get(ADVISOR_QUERY_PARAM) : segments.length === 1 ? segments[0] : null;
  if (!candidate) return NextResponse.next();

  const id = normalizeAdvisorId(candidate);
  const valid = id ? await isActiveAdvisor(id) : false;

  // /palabra-que-no-es-asesor → sigue su curso normal (página o 404).
  if (!fromQuery && !valid) return NextResponse.next();

  // Se limpia la URL: /cristian → /   ·   /cotizar?asesor=cristian → /cotizar
  const target = url.clone();
  if (fromQuery) target.searchParams.delete(ADVISOR_QUERY_PARAM);
  else target.pathname = "/";

  const response = NextResponse.redirect(target, 307);
  if (valid && id) {
    response.cookies.set(ADVISOR_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADVISOR_COOKIE_DAYS * 86_400,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/* ──────────────────────────────── Protección /admin ─────────────────────────────── */

async function protectAdmin(request: NextRequest) {
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
  // Todas las páginas, excepto archivos estáticos (con punto), /_next y /api.
  matcher: ["/((?!_next/static|_next/image|api/|.*\\..*).*)"],
};
